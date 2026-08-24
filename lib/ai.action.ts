import puter from "@heyputer/puter.js";
import {ROOMIFY_RENDER_PROMPT} from "./constants";

export const fetchAsDataUrl = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }

  const blob = await response.blob();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const getImageDimensions = (url: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve({ width: 1024, height: 1024 });
      return;
    }
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth || img.width || 1024,
        height: img.naturalHeight || img.height || 1024,
      });
    };
    img.onerror = () => {
      resolve({ width: 1024, height: 1024 });
    };
    img.src = url;
  });
};

const getClosestAspectRatio = (width: number, height: number): { w: number; h: number } => {
  if (!width || !height) return { w: 1, h: 1 };
  const ratio = width / height;
  const standardRatios = [
    { w: 16, h: 9, val: 16 / 9 },
    { w: 4, h: 3, val: 4 / 3 },
    { w: 1, h: 1, val: 1 / 1 },
    { w: 3, h: 4, val: 3 / 4 },
    { w: 9, h: 16, val: 9 / 16 },
  ];
  let closest = standardRatios[0];
  let minDiff = Math.abs(ratio - closest.val);
  for (let i = 1; i < standardRatios.length; i++) {
    const diff = Math.abs(ratio - standardRatios[i].val);
    if (diff < minDiff) {
      minDiff = diff;
      closest = standardRatios[i];
    }
  }
  return { w: closest.w, h: closest.h };
};

export const generate3DView = async ({ sourceImage }: Generate3DViewParams) => {
    const dataUrl = sourceImage.startsWith('data:')
        ? sourceImage
        : await fetchAsDataUrl(sourceImage);

    const base64Data = dataUrl.split(',')[1];
    const mimeType = dataUrl.split(';')[0].split(':')[1];

    if(!mimeType || !base64Data) throw new Error('Invalid source image payload');

    const dimensions = await getImageDimensions(dataUrl);
    const ratio = getClosestAspectRatio(dimensions.width, dimensions.height);

    const response = await puter.ai.txt2img(ROOMIFY_RENDER_PROMPT, {
        provider: "gemini",
        model: "gemini-2.5-flash-image-preview",
        input_image: base64Data,
        input_image_mime_type: mimeType,
        ratio,
    });

    const rawImageUrl = (response as HTMLImageElement).src ?? null;

    if (!rawImageUrl) return { renderedImage: null, renderedPath: undefined };

    const renderedImage = rawImageUrl.startsWith('data:')
        ? rawImageUrl : await fetchAsDataUrl(rawImageUrl);

    return { renderedImage, renderedPath: undefined };
}