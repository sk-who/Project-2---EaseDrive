import { Models } from "node-appwrite";
import Link from "next/link";
import Thumbnail from "@/components/Thumbnail";
import { convertFileSize } from "@/lib/utils";
import FormattedDateTime from "@/components/FormattedDateTime";
import ActionDropdown from "@/components/ActionDropdown";
import TagDisplay from "@/components/TagDisplay";

const Card = ({ file }: { file: Models.Document }) => {
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
