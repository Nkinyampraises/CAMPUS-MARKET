import { useState, useRef } from 'react';
import { Camera, Upload, X, Loader2, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/app/components/ui/dialog';
import { toast } from 'sonner';
import { API_URL } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface DeliveryProofModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the uploaded image URL once the seller taps "Confirm Delivery" */
  onConfirm: (proofImageUrl: string) => Promise<void>;
  /** While the parent is submitting the proof to the backend */
  submitting?: boolean;
}

export function DeliveryProofModal({
  open,
  onClose,
  onConfirm,
  submitting = false,
}: DeliveryProofModalProps) {
  const { accessToken, refreshAuthToken } = useAuth();

  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // ── helpers ──────────────────────────────────────────────────────────────

  const resetState = () => {
    setPreview(null);
    setSelectedFile(null);
    setUploadedUrl(null);
    if (galleryInputRef.current) galleryInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleClose = () => {
    if (uploading || submitting) return; // don't close mid-upload
    resetState();
    onClose();
  };

  // ── file selection ────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10 MB');
      return;
    }

    // reset any previously uploaded URL when user picks a new file
    setUploadedUrl(null);
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => {
    setPreview(null);
    setSelectedFile(null);
    setUploadedUrl(null);
    if (galleryInputRef.current) galleryInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // ── upload to server ──────────────────────────────────────────────────────

  const uploadPhoto = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('type', 'listing'); // reuses your existing upload endpoint

      let token = accessToken || localStorage.getItem('accessToken');

      let response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      // token expired — refresh and retry once
      if (response.status === 401) {
        const refreshed = await refreshAuthToken();
        if (refreshed) {
          token = refreshed;
          response = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${refreshed}` },
            body: formData,
          });
        }
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        toast.error(err.error || 'Failed to upload photo');
        return;
      }

      const result = await response.json();
      setUploadedUrl(result.url);
      toast.success('Photo uploaded — ready to confirm');
    } catch {
      toast.error('Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  // ── confirm delivery ──────────────────────────────────────────────────────

  const handleConfirm = async () => {
    if (!uploadedUrl) {
      toast.error('Please upload a photo first');
      return;
    }
    await onConfirm(uploadedUrl);
    resetState();
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-green-600" />
            Delivery Proof Photo
          </DialogTitle>
          <DialogDescription>
            Take or upload a clear photo of the buyer receiving the item.
            This confirms delivery and releases the escrow funds to you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hidden inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Photo preview */}
          {preview ? (
            <div className="relative rounded-lg overflow-hidden border bg-gray-50">
              <img
                src={preview}
                alt="Delivery proof preview"
                className="w-full max-h-64 object-contain"
              />
              {/* Remove photo */}
              {!uploading && !submitting && (
                <button
                  type="button"
                  onClick={clearPhoto}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  title="Remove photo"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {/* Uploaded badge */}
              {uploadedUrl && (
                <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                  <CheckCircle className="h-3 w-3" />
                  Uploaded
                </div>
              )}
            </div>
          ) : (
            /* Empty drop-zone */
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-green-600 transition-colors"
              onClick={() => galleryInputRef.current?.click()}
            >
              <ImageIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-1">
                Click to pick a photo from your device
              </p>
              <p className="text-xs text-muted-foreground">PNG, JPG, WEBP — up to 10 MB</p>
            </div>
          )}

          {/* Pick-photo buttons (visible only before a photo is chosen) */}
          {!preview && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="h-4 w-4 mr-2" />
                Take Photo
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => galleryInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Browse Gallery
              </Button>
            </div>
          )}

          {/* Upload button (visible after file is picked but before it's been sent) */}
          {preview && !uploadedUrl && (
            <Button
              type="button"
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              onClick={uploadPhoto}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading photo…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Photo
                </>
              )}
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={uploading || submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!uploadedUrl || submitting || uploading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Confirming…
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirm Delivery
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
