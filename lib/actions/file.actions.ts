"use server";

import { createAdminClient, createSessionClient } from "@/lib/appwrite";
import { InputFile } from "node-appwrite/file";
import { appwriteConfig } from "@/lib/appwrite/config";
import { ID, Models, Query } from "node-appwrite";
import { constructFileUrl, getFileType, parseStringify } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/actions/user.actions";
import { GoogleGenerativeAI } from "@google/generative-ai";

const handleError = (error: unknown, message: string) => {
  console.log(error, message);
  throw error;
};

// Generate image captions using Google Gemini
export const generateImageCaption = async (imageUrl: string) => {
  try {
    // Initialize the Google Generative AI with your API key
    // In production, use environment variables for the API key
    const genAI = new GoogleGenerativeAI(
      process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""
    );

    // Use gemini-1.5-flash model instead of the deprecated gemini-pro-vision
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-pro-exp-03-25",
    });

    // Fetch the image data
    const imageResponse = await fetch(imageUrl);
    const imageBlob = await imageResponse.blob();

    // Convert the blob to base64 using Node.js Buffer
    // (FileReader is browser-only and doesn't exist in Node.js)
    const arrayBuffer = await imageBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString("base64");

    // Create image part for the Gemini API
    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: imageBlob.type,
      },
    };

    // Generate the caption
    const result = await model.generateContent([
      imagePart,
      "Generate a brief caption for this image in 10 words or less. Be descriptive but concise.",
    ]);

    const response = result.response;
    const caption = response.text().trim();

    return caption;
  } catch (error) {
    console.error("Error generating image caption:", error);
    // Return a default caption if there's an error
    return "Image";
  }
};

export const uploadFile = async ({
  file,
  ownerId,
  accountId,
  path,
}: UploadFileProps) => {
  const { storage, databases } = await createAdminClient();

  try {
    const inputFile = InputFile.fromBuffer(file, file.name);

    const bucketFile = await storage.createFile(
      appwriteConfig.bucketId,
      ID.unique(),
      inputFile
    );

    const fileType = getFileType(bucketFile.name);
    const fileUrl = constructFileUrl(bucketFile.$id);

    // Generate caption for images
    let caption = "";
    if (fileType.type === "image" && fileType.extension !== "svg") {
      try {
        caption = await generateImageCaption(fileUrl);
      } catch (error) {
        console.error("Failed to generate caption:", error);
        caption = "Image"; // Default caption
      }
    }

    const fileDocument = {
      type: fileType.type,
      name: bucketFile.name,
      url: fileUrl,
      extension: fileType.extension,
      size: bucketFile.sizeOriginal,
      owner: ownerId,
      accountId,
      users: [],
      bucketFileId: bucketFile.$id,
      tagIds: [],
      caption: caption, // Add caption field
    };

    const newFile = await databases
      .createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.filesCollectionId,
        ID.unique(),
        fileDocument
      )
      .catch(async (error: unknown) => {
        await storage.deleteFile(appwriteConfig.bucketId, bucketFile.$id);
        handleError(error, "Failed to create file document");
      });

    // Process image embedding if this is an image
    if (fileDocument.type === "image" && newFile) {
      try {
        // Import the processImageEmbedding function
        const { processImageEmbedding } = await import("./tag.actions");

        // Process the image in the background to avoid blocking
        processImageEmbedding(newFile.$id, fileDocument.url, ownerId).catch(
          (error) => {
            console.error("Background embedding process failed:", error);
          }
        );
      } catch (error) {
        console.error("Failed to process image embedding:", error);
        // Continue with the flow even if embedding fails
      }
    }

    revalidatePath(path);
    return parseStringify(newFile);
  } catch (error) {
    handleError(error, "Failed to upload file");
  }
};

const createQueries = (
  currentUser: Models.Document,
  types: string[],
  searchText: string,
  sort: string,
  limit?: number
) => {
  const queries = [
    Query.or([
      Query.equal("owner", [currentUser.$id]),
      Query.contains("users", [currentUser.email]),
    ]),
  ];

  if (types.length > 0) queries.push(Query.equal("type", types));
  if (searchText) queries.push(Query.contains("name", searchText));
  if (limit) queries.push(Query.limit(limit));

  if (sort) {
    const [sortBy, orderBy] = sort.split("-");

    queries.push(
      orderBy === "asc" ? Query.orderAsc(sortBy) : Query.orderDesc(sortBy)
    );
  }

  return queries;
};

export const getFiles = async ({
  types = [],
  searchText = "",
  sort = "$createdAt-desc",
  limit,
}: GetFilesProps) => {
  const { databases } = await createAdminClient();

  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) throw new Error("User not found");

    const queries = createQueries(currentUser, types, searchText, sort, limit);

    const files = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollectionId,
      queries
    );

    console.log({ files });
    return parseStringify(files);
  } catch (error) {
    handleError(error, "Failed to get files");
  }
};

export const renameFile = async ({
  fileId,
  name,
  extension,
  path,
}: RenameFileProps) => {
  const { databases } = await createAdminClient();

  try {
    const newName = `${name}.${extension}`;
    const updatedFile = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollectionId,
      fileId,
      {
        name: newName,
      }
    );

    revalidatePath(path);
    return parseStringify(updatedFile);
  } catch (error) {
    handleError(error, "Failed to rename file");
  }
};

export const updateFileUsers = async ({
  fileId,
  emails,
  path,
}: UpdateFileUsersProps) => {
  const { databases } = await createAdminClient();

  try {
    const updatedFile = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollectionId,
      fileId,
      {
        users: emails,
      }
    );

    revalidatePath(path);
    return parseStringify(updatedFile);
  } catch (error) {
    handleError(error, "Failed to rename file");
  }
};

export const deleteFile = async ({
  fileId,
  bucketFileId,
  path,
}: DeleteFileProps) => {
  const { databases, storage } = await createAdminClient();

  try {
    const deletedFile = await databases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollectionId,
      fileId
    );

    if (deletedFile) {
      await storage.deleteFile(appwriteConfig.bucketId, bucketFileId);
    }

    revalidatePath(path);
    return parseStringify({ status: "success" });
  } catch (error) {
    handleError(error, "Failed to rename file");
  }
};

// ============================== TOTAL FILE SPACE USED
export async function getTotalSpaceUsed() {
  try {
    const { databases } = await createSessionClient();
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error("User is not authenticated.");

    const files = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollectionId,
      [Query.equal("owner", [currentUser.$id])]
    );

    const totalSpace = {
      image: { size: 0, latestDate: "" },
      document: { size: 0, latestDate: "" },
      video: { size: 0, latestDate: "" },
      audio: { size: 0, latestDate: "" },
      other: { size: 0, latestDate: "" },
      used: 0,
      all: 2 * 1024 * 1024 * 1024 /* 2GB available bucket storage */,
    };

    files.documents.forEach((file) => {
      const fileType = file.type as FileType;
      totalSpace[fileType].size += file.size;
      totalSpace.used += file.size;

      if (
        !totalSpace[fileType].latestDate ||
        new Date(file.$updatedAt) > new Date(totalSpace[fileType].latestDate)
      ) {
        totalSpace[fileType].latestDate = file.$updatedAt;
      }
    });

    return parseStringify(totalSpace);
  } catch (error) {
    handleError(error, "Error calculating total space used:, ");
  }
}

export const updateFileCaption = async ({
  fileId,
  caption,
  path,
}: {
  fileId: string;
  caption: string;
  path: string;
}) => {
  const { databases } = await createAdminClient();

  try {
    const updatedFile = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollectionId,
      fileId,
      {
        caption: caption,
      }
    );

    revalidatePath(path);
    return parseStringify(updatedFile);
  } catch (error) {
    handleError(error, "Failed to update file caption");
  }
};
