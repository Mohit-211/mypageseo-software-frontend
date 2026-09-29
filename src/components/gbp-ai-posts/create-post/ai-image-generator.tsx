import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, RefreshCw, Sparkles, Trash2, Upload } from "lucide-react";
import { Panel } from "@/components/layout/shared/data-display";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { generateAiPostImage } from "@/lib/gbp/ai-posts";
import { AiIndicator, PostThumbnail } from "../post-ui";
import { FORM_TOAST, type FormSectionProps } from "./form-model";

const MAX_UPLOAD_MB = 5;

export function AIImageGenerator({ form, onChange }: Omit<FormSectionProps, "errors">) {
  const [generating, setGenerating] = useState(false);
  const [variant, setVariant] = useState(1);
  const fileInput = useRef<HTMLInputElement>(null);
  const topic = form.topic.trim();

  const generate = async () => {
    if (!topic) {
      toast.error("Add a post topic first", { ...FORM_TOAST, description: "AI uses the topic to create a matching image." });
      return;
    }
    setGenerating(true);
    try {
      const url = await generateAiPostImage(topic, variant);
      setVariant((v) => v + 1);
      onChange({ imageUrl: url, imageSource: "ai" });
      toast.success("Image generated", FORM_TOAST);
    } catch {
      toast.error("AI couldn't create an image", { ...FORM_TOAST, description: "Try again or upload your own." });
    } finally {
      setGenerating(false);
    }
  };

  const upload = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Unsupported file", { ...FORM_TOAST, description: "Upload a JPG or PNG image." });
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      toast.error("Image is too large", { ...FORM_TOAST, description: `Keep images under ${MAX_UPLOAD_MB} MB.` });
      return;
    }
    onChange({ imageUrl: URL.createObjectURL(file), imageSource: "upload" });
    toast.success("Image uploaded", FORM_TOAST);
  };

  return (
    <Panel title="Post image" description="Generate an image with AI or upload your own." actions={<AiIndicator label="AI image" />}>
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {generating ? (
        <div role="status" className="relative aspect-[4/3] w-full max-w-xl overflow-hidden rounded-md">
          <Skeleton className="size-full bg-brand-tint-strong" />
          <p className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-medium text-primary">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Creating image…
          </p>
        </div>
      ) : form.imageUrl ? (
        <div className="space-y-3">
          <div className="relative w-full max-w-xl">
            <PostThumbnail src={form.imageUrl} alt="Post image preview" className="aspect-[4/3] w-full" iconClassName="size-8" />
            <span className="absolute left-2 top-2">
              {form.imageSource === "ai" ? (
                <AiIndicator label="AI generated" className="bg-surface/95 shadow-card" />
              ) : (
                <span className="rounded-md bg-surface/95 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shadow-card">Uploaded</span>
              )}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={generate} disabled={!topic}>
              <RefreshCw aria-hidden /> Regenerate image
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
              <Upload aria-hidden /> Upload custom image
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onChange({ imageUrl: null, imageSource: null })}>
              <Trash2 aria-hidden /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-md border border-dashed border-border bg-surface-strong/50 px-6 py-8 text-center">
          <ImagePlus className="size-6 text-brand-soft" aria-hidden />
          <p className="mt-2 text-sm font-medium text-foreground">No image yet</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Posts with images get noticeably more engagement. Recommended 1200 × 900, JPG or PNG, up to {MAX_UPLOAD_MB} MB.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button onClick={generate} disabled={!topic}>
              <Sparkles aria-hidden /> Generate AI Image
            </Button>
            <Button variant="outline" onClick={() => fileInput.current?.click()}>
              <Upload aria-hidden /> Upload image
            </Button>
          </div>
          {!topic ? <p className="mt-2 text-xs text-muted-foreground">Add a post topic to generate an image.</p> : null}
        </div>
      )}
    </Panel>
  );
}
