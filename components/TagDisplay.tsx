"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getFileTags } from "@/lib/actions/tag.actions";
import { updateTagName } from "@/lib/actions/tag.actions";
import { useToast } from "@/hooks/use-toast";

interface TagDisplayProps {
  fileId: string;
  userId: string;
  editable?: boolean;
}

interface Tag {
  name: string;
  tagId: string;
}

const TagDisplay = ({ fileId, userId, editable = true }: TagDisplayProps) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentTag, setCurrentTag] = useState<{ name: string; tagId: string }>(
    {
      name: "",
      tagId: "",
    }
  );
  const [newTagName, setNewTagName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const fetchTags = async () => {
      setLoading(true);
      try {
        const tagList = await getFileTags(fileId, userId);
        setTags(tagList);
      } catch (error) {
        console.error("Failed to fetch tags:", error);
        toast({
          title: "Error",
          description: "Failed to load tags",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (fileId && userId) {
      fetchTags();
    }
  }, [fileId, userId, toast]);

  const handleEditTag = (tagName: string, tagId: string) => {
    setCurrentTag({ name: tagName, tagId: tagId });
    setNewTagName(tagName);
    setEditDialogOpen(true);
  };

  const handleSaveTagName = async () => {
    if (!newTagName.trim() || newTagName === currentTag.name) {
      setEditDialogOpen(false);
      return;
    }

    try {
      await updateTagName(
        currentTag.tagId,
        newTagName,
        window.location.pathname
      );

      // Update local state to reflect the changes
      setTags(
        tags.map((tag) =>
          tag.tagId === currentTag.tagId ? { ...tag, name: newTagName } : tag
        )
      );

      toast({
        title: "Success",
        description: "Tag name updated successfully",
      });
    } catch (error) {
      console.error("Failed to update tag name:", error);
      toast({
        title: "Error",
        description: "Failed to update tag name",
        variant: "destructive",
      });
    } finally {
      setEditDialogOpen(false);
    }
  };

  if (loading) {
    return <div className="flex gap-1 flex-wrap">Loading tags...</div>;
  }

  if (!tags.length) {
    return <div className="text-sm text-muted-foreground">No tags found</div>;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 my-2">
        {tags.map((tag, index) => (
          <div
            key={index}
            className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full text-sm"
          >
            <span>{tag.name}</span>
            {editable && (
              <button
                onClick={() => handleEditTag(tag.name, tag.tagId)}
                className="ml-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Input
                id="tag-name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="col-span-3"
                placeholder="Enter new tag name"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTagName}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TagDisplay;
