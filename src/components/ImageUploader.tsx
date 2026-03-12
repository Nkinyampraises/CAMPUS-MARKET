import { useState, useRef } from 'react';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
  type?: 'listing' | 'profile';
}

import { API_URL } from '@/lib/api';

export function ImageUploader({ images, onChange, maxImages = 5, type = 'listing' }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { accessToken, refreshAuthToken } = useAuth();

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length === 0) return;

    if (images.length + files.length > maxImages) {
      toast.error(`You can only upload up to ${maxImages} images`);
      return;
    }

    setUploading(true);

    try {
      const uploadedUrls: string[] = [];

      for (const file of files) {
        // Validate file size (max 5MB)
        if (file.size > 5242880) {
          toast.error(`${file.name} is too large. Max size is 5MB`);
          continue;
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} is not an image`);
          continue;
        }

        let token = accessToken || localStorage.getItem('accessToken');
        let response = await uploadFileWithToken(file, token);

        if (response.status === 401) {
          const refreshed = await refreshAuthToken();
          token = refreshed || token;
          if (refreshed) {
            response = await uploadFileWithToken(file, refreshed);
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
            toast.error(error.error || 'Failed to upload image');
          }
        }
      }

      if (uploadedUrls.length > 0) {
        onChange([...images, ...uploadedUrls]);
        toast.success(`${uploadedUrls.length} image(s) uploaded successfully`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload images');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onChange(newImages);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Images ({images.length}/{maxImages})</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleBrowseClick}
          disabled={uploading || images.length >= maxImages}
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
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
      {images.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((url, index) => (
            <div key={index} className="relative aspect-square rounded-lg overflow-hidden border bg-gray-100 group">
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
            PNG, JPG, WEBP up to 5MB (max {maxImages} images)
          </p>
        </div>
      )}

      {images.length > 0 && images.length < maxImages && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleBrowseClick}
          disabled={uploading}
        >
          <Upload className="mr-2 h-4 w-4" />
          Add More Images ({maxImages - images.length} remaining)
        </Button>
      )}
    </div>
  );
}
