"use client";

export type StudentPhotoCrop = {
  zoom: number;
  x: number;
  y: number;
};

const PASSPORT_WIDTH = 600;
const PASSPORT_HEIGHT = 800;

export async function cropStudentPhotoFile(
  file: File,
  crop: StudentPhotoCrop
): Promise<File> {
  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = PASSPORT_WIDTH;
  canvas.height = PASSPORT_HEIGHT;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Photo crop failed");
  }

  const sourceAspect = image.naturalWidth / image.naturalHeight;
  const targetAspect = PASSPORT_WIDTH / PASSPORT_HEIGHT;
  const baseWidth = sourceAspect > targetAspect
    ? image.naturalHeight * targetAspect
    : image.naturalWidth;
  const baseHeight = sourceAspect > targetAspect
    ? image.naturalHeight
    : image.naturalWidth / targetAspect;
  const zoom = Math.max(1, Math.min(crop.zoom, 2.5));
  const cropWidth = baseWidth / zoom;
  const cropHeight = baseHeight / zoom;
  const maxX = Math.max(0, image.naturalWidth - cropWidth);
  const maxY = Math.max(0, image.naturalHeight - cropHeight);
  const sourceX = maxX * (crop.x / 100);
  const sourceY = maxY * (crop.y / 100);

  context.drawImage(
    image,
    sourceX,
    sourceY,
    cropWidth,
    cropHeight,
    0,
    0,
    PASSPORT_WIDTH,
    PASSPORT_HEIGHT
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, file.type || "image/jpeg", 0.9);
  });

  if (!blob) {
    throw new Error("Photo crop failed");
  }

  return new File([blob], file.name, {
    type: blob.type || file.type || "image/jpeg",
    lastModified: Date.now(),
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Photo crop failed"));
    };
    image.src = url;
  });
}
