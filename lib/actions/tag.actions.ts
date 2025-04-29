"use server";

import { createAdminClient, createSessionClient } from "@/lib/appwrite";
import { appwriteConfig } from "@/lib/appwrite/config";
import { ID, Models, Query } from "node-appwrite";
import { parseStringify } from "@/lib/utils";
import { getCurrentUser } from "./user.actions";
import { revalidatePath } from "next/cache";

const handleError = (error: unknown, message: string) => {
  console.log(error, message);
  throw error;
};

// Send image to embedding API for processing
export const processImageEmbedding = async (
  fileId: string,
  fileUrl: string,
  userId: string
) => {
  const url = "https://project-2-easedrive.uw.r.appspot.com";
  try {
    const response = await fetch(url+"/embedding", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: fileUrl,
        user_id: userId,
        file_id: fileId,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to process image embedding");
    }

    const data = await response.json();

    // Add tags to the file
    const { databases } = await createAdminClient();
    const tagIds = data.results.map((result: any) => result.tag_id);

    // Update file with tag IDs
    await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollectionId,
      fileId,
      { tagIds }
    );

    // Create or update tag documents in the tags collection
    for (const result of data.results) {
      // Check if tag already exists with this tagId
      const existingTags = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.tagsCollectionId,
        [Query.equal("tagId", [result.tag_id])]
      );

      // If tag doesn't exist, create it
      if (existingTags.total === 0) {
        await databases.createDocument(
          appwriteConfig.databaseId,
          appwriteConfig.tagsCollectionId,
          ID.unique(),
          {
            tagName: result.tag_name,
            tagId: result.tag_id,
            embeddingId: result.face_path,
            userId,
          }
        );
      }
    }

    return parseStringify(data);
  } catch (error) {
    handleError(error, "Failed to process image embedding");
  }
};

// Get tags for a specific file
export const getFileTags = async (fileId: string, userId: string) => {
  try {
    // First, get the file to access its tagIds
    const { databases } = await createAdminClient();
    const file = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollectionId,
      fileId
    );

    if (!file || !file.tagIds || file.tagIds.length === 0) {
      return parseStringify([]);
    }

    // Fetch all tags for the file
    const tagsList = [];

    for (const tagId of file.tagIds) {
      // Handle both string tagIds and object tagIds
      let currentTagId;
      let currentTagName;

      if (typeof tagId === "string") {
        currentTagId = tagId;
      } else if (typeof tagId === "object" && tagId !== null) {
        // If tagId is an object with tagName and $id properties
        currentTagId = tagId.$id || tagId.tagId;
        currentTagName = tagId.tagName;

        // If we already have both id and name from the object, add directly to list
        if (currentTagId && currentTagName) {
          tagsList.push({
            name: currentTagName,
            tagId: currentTagId,
          });
          continue;
        }
      }

      // Skip undefined, null, or invalid tagIds
      if (!currentTagId) {
        console.log(`Skipping invalid tagId: ${JSON.stringify(tagId)}`);
        continue;
      }

      try {
        const tags = await databases.listDocuments(
          appwriteConfig.databaseId,
          appwriteConfig.tagsCollectionId,
          [Query.equal("tagId", [currentTagId])]
        );

        if (tags.total > 0) {
          tagsList.push({
            name: tags.documents[0].tagName,
            tagId: tags.documents[0].tagId,
          });
        }
      } catch (queryError) {
        console.error(`Error querying for tagId ${currentTagId}:`, queryError);
        // Continue with other tagIds even if one fails
      }
    }

    return parseStringify(tagsList);
  } catch (error) {
    handleError(error, "Failed to get file tags");
    return parseStringify([]);
  }
};

// Get all tags for a user (for search suggestions)
export const getUserTags = async () => {
  try {
    const { databases } = await createSessionClient();
    const currentUser = await getCurrentUser();

    if (!currentUser) throw new Error("User not authenticated");

    const tags = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.tagsCollectionId,
      [Query.equal("userId", [currentUser.$id])]
    );

    return parseStringify(
      tags.documents.map((tag) => ({
        id: tag.$id,
        name: tag.tagName,
        tagId: tag.tagId,
      }))
    );
  } catch (error) {
    handleError(error, "Failed to get user tags");
    return parseStringify([]);
  }
};

// Update tag name
export const updateTagName = async (
  tagId: string,
  newName: string,
  path: string
) => {
  try {
    const { databases } = await createAdminClient();
    const currentUser = await getCurrentUser();

    if (!currentUser) throw new Error("User not authenticated");

    // First, get the original tag document to find its current name
    const originalTag = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.tagsCollectionId,
      tagId
    );

    // Get the old name from the original tag
    const oldName = originalTag.tagName;

    // Find all tags with the same name belonging to this user
    const sameTags = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.tagsCollectionId,
      [
        Query.equal("tagName", [oldName]),
        Query.equal("userId", [currentUser.$id]),
      ]
    );

    // Update all tags with the same name to the new name
    for (const tag of sameTags.documents) {
      await databases.updateDocument(
        appwriteConfig.databaseId,
        appwriteConfig.tagsCollectionId,
        tag.$id,
        { tagName: newName }
      );
    }

    // Revalidate the path to update UI
    revalidatePath(path);

    return parseStringify({
      success: true,
      message: `All occurrences of "${oldName}" updated to "${newName}" successfully`,
    });
  } catch (error) {
    handleError(error, "Failed to update tag names");
  }
};

// Search files by tag
export const searchFilesByTag = async (tagName: string) => {
  try {
    const { databases } = await createAdminClient();
    const currentUser = await getCurrentUser();

    if (!currentUser) throw new Error("User not authenticated");

    // First, find all tags with this name
    const tags = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.tagsCollectionId,
      [
        Query.equal("tagName", [tagName]),
        Query.equal("userId", [currentUser.$id]),
      ]
    );

    if (tags.total === 0) {
      return parseStringify({ files: [] });
    }

    // Get all tag IDs that match this name
    const tagIds = tags.documents.map((tag) => tag.tagId);

    // Since we can't search directly with an array of tagIds, we need to fetch all files
    // and then filter them manually
    const allUserFiles = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollectionId,
      [
        Query.or([
          Query.equal("owner", [currentUser.$id]),
          Query.contains("users", [currentUser.email]),
        ]),
        Query.limit(100), // Increase this if needed, but be aware of performance implications
      ]
    );

    // Filter files that contain any of the searched tag IDs
    const matchingFiles = allUserFiles.documents.filter((file) => {
      // Guard against missing tagIds
      if (!file.tagIds || !Array.isArray(file.tagIds)) {
        return false;
      }

      // Check if any of the file's tagIds match any of our search tagIds
      return file.tagIds.some((fileTagId) => {
        // Handle both string and object tagIds
        const fileTagIdValue =
          typeof fileTagId === "string" ? fileTagId : fileTagId.tagId;
        return tagIds.includes(fileTagIdValue);
      });
    });

    return parseStringify({ files: matchingFiles });
  } catch (error) {
    handleError(error, "Failed to search files by tag");
    return parseStringify({ files: [] });
  }
};
