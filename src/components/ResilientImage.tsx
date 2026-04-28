import { useEffect, useMemo, useState } from "react";
import type { ImgHTMLAttributes, ReactNode } from "react";

import { buildImageCandidates } from "@/lib/images";

type ResilientImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string | null;
  fallback?: ReactNode;
};

export function ResilientImage({ src, fallback = null, onError, ...props }: ResilientImageProps) {
  const candidates = useMemo(() => buildImageCandidates(src), [src]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [isExhausted, setIsExhausted] = useState(false);

  useEffect(() => {
    setCandidateIndex(0);
    setIsExhausted(false);
  }, [src]);

  if (!candidates.length || isExhausted) {
    return <>{fallback}</>;
  }

  const activeSrc = candidates[candidateIndex];

  return (
    <img
      {...props}
      src={activeSrc}
      onError={(event) => {
        onError?.(event);

        setCandidateIndex((current) => {
          const nextIndex = current + 1;
          if (nextIndex >= candidates.length) {
            setIsExhausted(true);
            return current;
          }
          return nextIndex;
        });
      }}
    />
  );
}
