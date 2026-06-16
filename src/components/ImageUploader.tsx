import { useState, useRef } from 'react';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { removeBackground } from '@imgly/background-removal';

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
  type?: 'listing' | 'profile';
}

import { API_URL } from '@/lib/api';

type PendingFile = {
  localUrl: string;
  status: 'processing' | 'uploading';
};

async function addWhiteBackground(blob: Blob): Promise<Blob> {
  const img = new Image();
  const url = URL.createObjectURL(blob);
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = rej;
    img.src = url;
  });
  URL.revokeObjectURL(url);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  return new Promise(res => canvas.toBlob(res as BlobCallback, 'image/png'));
}

export function ImageUploader({ images, onChange, maxImages = 5, type = 'listing' }: ImageUploaderProps) {
  const [pendingFiles, setPendingFiles] = useState<Map<string, PendingFile>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { accessToken, refreshAuthToken } = useAuth();

  const uploading = pendingFiles.size > 0;

  const uploadFileWithToken = async (file: File, token?: string | null) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return fetch(`${API_URL}/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
  };

  const setPendingStatus = (id: string, status: PendingFile['status']) => {
    setPendingFiles(prev => {
      const next = new Map(prev);
      const entry = next.get(id);
      if (entry) next.set(id, { ...entry, status });
      return next;
    });
  };

  const removePending = (id: string, localUrl: string) => {
    URL.revokeObjectURL(localUrl);
    setPendingFiles(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    if (images.length + files.length > maxImages) {
      toast.error(`You can only upload up to ${maxImages} images`);
      return;
    }

    // Register all pending files immediately so thumbnails appear at once
    const pendingEntries: Array<{ id: string; file: File; localUrl: string }> = [];

    for (const file of files) {
      if (file.size > 5242880) {
        toast.error(`${file.name} is too large. Max size is 5MB`);
        continue;
      }
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image`);
        continue;
      }
      const id = `pending-${Date.now()}-${Math.random()}`;
      const localUrl = URL.createObjectURL(file);
      pendingEntries.push({ id, file, localUrl });
    }

    if (pendingEntries.length === 0) return;

    setPendingFiles(prev => {
      const next = new Map(prev);
      for (const { id, localUrl } of pendingEntries) {
        next.set(id, { localUrl, status: 'processing' });
      }
      return next;
    });

    if (fileInputRef.current) fileInputRef.current.value = '';

    const uploadedUrls: string[] = [];

    for (const { id, file, localUrl } of pendingEntries) {
      try {
        // Remove background
        let processedBlob: Blob;
        try {
          const transparent = await removeBackground(file);
          processedBlob = await addWhiteBackground(transparent);
        } catch {
          toast.warning(`Could not remove background for ${file.name} — uploading original`);
          processedBlob = file;
        }

        setPendingStatus(id, 'uploading');

        const processedName = file.name.replace(/\.[^.]+$/, '.png');
        const processedFile = new File([processedBlob], processedName, { type: 'image/png' });

        let token = accessToken || localStorage.getItem('accessToken');
        let response = await uploadFileWithToken(processedFile, token);

        if (response.status === 401) {
          const refreshed = await refreshAuthToken();
          token = refreshed || token;
          if (refreshed) {
            response = await uploadFileWithToken(processedFile, refreshed);
          }
        }

        if (response.ok) {
          const data = await response.json();
          uploadedUrls.push(data.url);
        } else {
          const error = await response.json().catch(() => ({}));
          if (response.status === 401) {
            toast.error('Session expired. Please log in again.');
          } else {
            toast.error(error.error || `Failed to upload ${file.name}`);
          }
        }
      } catch {
        toast.error(`Failed to process ${file.name}`);
      } finally {
        removePending(id, localUrl);
      }
    }

    if (uploadedUrls.length > 0) {
      onChange([...images, ...uploadedUrls]);
      toast.success(`${uploadedUrls.length} image(s) uploaded successfully`);
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onChange(newImages);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const totalCount = images.length + pendingFiles.size;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Images ({totalCount}/{maxImages})</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleBrowseClick}
          disabled={uploading || totalCount >= maxImages}
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Browse Gallery
            </>
          )}
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Image Preview Grid */}
      {totalCount > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {/* Confirmed images */}
          {images.map((url, index) => (
            <div key={url} className="relative aspect-square rounded-lg overflow-hidden border bg-gray-100 group">
              <img
                src={url}
                alt={`Upload ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemoveImage(index)}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
              {index === 0 && (
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-green-600 text-white text-xs rounded">
                  Primary
                </div>
              )}
            </div>
          ))}

          {/* In-flight images */}
          {[...pendingFiles.entries()].map(([id, { localUrl, status }]) => (
            <div
              key={id}
              className="relative aspect-square rounded-lg overflow-hidden border bg-gray-100"
            >
              <img
                src={localUrl}
                alt="Processing"
                className="w-full h-full object-cover opacity-40"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                <span className="text-xs text-green-700 font-medium text-center px-1">
                  {status === 'processing' ? 'Removing background…' : 'Uploading…'}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-green-600 transition-colors"
          onClick={handleBrowseClick}
        >
          <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground mb-2">
            Click to browse your gallery or drag and drop images
          </p>
          <p className="text-xs text-muted-foreground">
            PNG, JPG, WEBP up to 5MB (max {maxImages} images) · Background removed automatically
          </p>
        </div>
      )}

      {totalCount > 0 && totalCount < maxImages && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleBrowseClick}
          disabled={uploading}
        >
          <Upload className="mr-2 h-4 w-4" />
          Add More Images ({maxImages - totalCount} remaining)
        </Button>
      )}
    </div>
  );
}
