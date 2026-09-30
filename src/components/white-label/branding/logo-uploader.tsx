import { FAVICON_RULES, LOGO_RULES, whiteLabelActions } from "@/lib/white-label/white-label";
import { ImageUploader, type UploadedImage } from "./image-uploader";

type UploaderProps = {
  value: string | null;
  fileName: string | null;
  onChange: (image: UploadedImage | null) => void;
  disabled?: boolean;
};

export function LogoUploader(props: UploaderProps) {
  return (
    <ImageUploader
      label="Logo"
      prompt="Upload your agency logo"
      rules={LOGO_RULES}
      upload={whiteLabelActions.uploadLogo}
      hint="Shown in the report header and footer. A wide logo on a transparent background works best."
      {...props}
    />
  );
}

export function FaviconUploader(props: UploaderProps) {
  return (
    <ImageUploader
      label="Favicon"
      prompt="Upload your favicon"
      rules={FAVICON_RULES}
      upload={whiteLabelActions.uploadFavicon}
      previewClassName="size-8"
      hint="Shown in the browser tab when clients open a report. Use a square image, at least 32 × 32 px."
      {...props}
    />
  );
}
