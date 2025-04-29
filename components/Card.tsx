"use client";

import { Models } from "node-appwrite";
import Link from "next/link";
import Thumbnail from "@/components/Thumbnail";
import { convertFileSize } from "@/lib/utils";
import FormattedDateTime from "@/components/FormattedDateTime";
import ActionDropdown from "@/components/ActionDropdown";
import TagDisplay from "@/components/TagDisplay";
import { useState, useEffect } from "react";
import {
  generateImageCaption,
  updateFileCaption,
} from "@/lib/actions/file.actions";
import { usePathname } from "next/navigation";

const Card = ({ file }: { file: Models.Document }) => {
  const [isLoadingCaption, setIsLoadingCaption] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const path = usePathname();

  useEffect(() => {
    // If this is an image and there's no caption yet, show loading state
    if (file.type === "image" && !caption) {
      setIsLoadingCaption(true);

      // If file already has a caption in the database, use it
      if (file.caption) {
        setCaption(file.caption);
        setIsLoadingCaption(false);
      } else {
        // Otherwise generate a new caption using Gemini
        generateImageCaption(file.url)
          .then((generatedCaption) => {
            setCaption(generatedCaption);
            // Save the generated caption to database
            updateFileCaption({
              fileId: file.$id,
              caption: generatedCaption,
              path,
            }).catch((error) => {
              console.error("Failed to update caption in database:", error);
            });
          })
          .catch((error) => {
            console.error("Error generating caption:", error);

            // Retry after 10 seconds on error
            setTimeout(() => {
              console.log("Retrying caption generation...");
              generateImageCaption(file.url)
                .then((generatedCaption) => {
                  setCaption(generatedCaption);
                  // Save the generated caption to database
                  updateFileCaption({
                    fileId: file.$id,
                    caption: generatedCaption,
                    path,
                  }).catch((error) => {
                    console.error(
                      "Failed to update caption in database:",
                      error
                    );
                  });
                })
                .catch((retryError) => {
                  console.error("Retry failed:", retryError);
                  setCaption("Image"); // Default caption after retry fails

                })
                .finally(() => {
                  setIsLoadingCaption(false);
                });
            }, 10000);

            // Don't call setIsLoadingCaption(false) here as we're retrying
          })
          .finally(() => {
            // Only set loading to false if there was no error (since we handle that in the retry)
            if (!caption) {
              setIsLoadingCaption(false);
            }
          });
      }
    }
  }, [file, caption, path]);

  return (
    <div className="file-card">
      <Link href={file.url} target="_blank" className="flex justify-between">
        <Thumbnail
          type={file.type}
          extension={file.extension}
          url={file.url}
          className="!size-20"
          imageClassName="!size-11"
        />

        <div className="flex flex-col items-end justify-between">
          <ActionDropdown file={file} />
          <p className="body-1">{convertFileSize(file.size)}</p>
        </div>
      </Link>

      <div className="file-card-details">
        <p className="subtitle-2 line-clamp-1">{file.name}</p>
        <FormattedDateTime
          date={file.$createdAt}
          className="body-2 text-light-100"
        />
        <p className="caption line-clamp-1 text-light-200">
          By: {file.owner.fullName}
        </p>

        {/* Display auto-generated caption if this is an image */}
        {file.type === "image" && (
          <div className="mt-1">
            {isLoadingCaption ? (
              <div className="flex items-center">
                <span className="text-xs text-light-100">Caption: </span>
                <div className="ml-1 h-1 w-16 bg-gray-200 rounded-full">
                  <div className="h-full bg-brand-500 w-1/2 animate-pulse rounded-full"></div>
                </div>
              </div>
            ) : (
              caption && (
                <p className="text-xs italic text-light-100 ">
                  Caption: {caption}
                </p>
              )
            )}
          </div>
        )}

        {/* Display tags if this is an image */}
        {file.type === "image" && file.$id && (
          <div className="mt-2">
            <TagDisplay fileId={file.$id} userId={file.owner} editable={true} />
          </div>
        )}
      </div>
    </div>
  );
};
export default Card;
