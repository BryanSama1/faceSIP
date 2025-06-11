
"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RefreshCw, CheckCircle2, AlertTriangle, VideoOff, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface FaceCaptureProps {
  onFaceCaptured: (dataUrl: string) => void;
  captureButtonText?: string;
  imageSize?: number; // Approximate size for the video/image preview square
}

const FaceCapture: React.FC<FaceCaptureProps> = ({ 
  onFaceCaptured, 
  captureButtonText = "Capture Face",
  imageSize = 300 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isTakingPicture, setIsTakingPicture] = useState(false);
  const { toast } = useToast();

  const startCamera = useCallback(async () => {
    if (isCameraActive || isStartingCamera) return;

    setError(null);
    setImageDataUrl(null);
    setIsStartingCamera(true);
    setIsCameraActive(false);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: imageSize, height: imageSize } });
        setStream(mediaStream);
        setIsCameraActive(true);
      } else {
        const msg = "Camera access not supported by your browser.";
        setError(msg);
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
    } catch (err) {
      console.error("Error accessing camera: ", err);
      let message = "Error accessing camera. Please ensure permissions are granted.";
      if (err instanceof Error) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          message = "Camera permission denied. Please enable it in your browser settings.";
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          message = "No camera found. Please ensure a camera is connected.";
        }
      }
      setError(message);
      toast({ title: "Camera Error", description: message, variant: "destructive" });
      setIsCameraActive(false);
    } finally {
      setIsStartingCamera(false);
    }
  }, [imageSize, toast, isCameraActive, isStartingCamera]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setIsCameraActive(false);
  }, [stream]);

  useEffect(() => {
    if (!imageDataUrl && !isCameraActive && !error && !isStartingCamera) {
      startCamera();
    }
  }, [imageDataUrl, isCameraActive, error, startCamera, isStartingCamera]);

  useEffect(() => {
    if (videoRef.current) {
      if (stream && isCameraActive) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(playError => {
          console.warn("Video play() failed:", playError);
          // setError("Could not automatically play video. Interaction may be required.");
        });
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream, isCameraActive]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const captureFace = () => {
    if (videoRef.current && canvasRef.current && stream && isCameraActive) {
      setIsTakingPicture(true);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        // Flip the image horizontally if video is mirrored (scaleX-[-1])
        context.translate(video.videoWidth, 0);
        context.scale(-1, 1);
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        // Reset transform for future draws if any
        context.setTransform(1, 0, 0, 1, 0, 0);
      }
      const dataUrl = canvas.toDataURL('image/png');
      setImageDataUrl(dataUrl);
      setIsTakingPicture(false);
    } else if (!isCameraActive) {
        toast({ title: "Camera Off", description: "Please start the camera first.", variant: "destructive" });
    }
  };

  const handleConfirm = () => {
    if (imageDataUrl) {
      onFaceCaptured(imageDataUrl);
      stopCamera();
    }
  };

  const handleRetake = () => {
    setImageDataUrl(null);
    setError(null);
    if (!isCameraActive && !isStartingCamera) {
      startCamera();
    }
  };

  const previewStyle = { width: `${imageSize}px`, height: `${imageSize}px` };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md">
      <div 
        className="relative rounded-lg overflow-hidden border-2 border-dashed border-primary bg-muted data-[capturing=true]:animate-pulse-border"
        style={previewStyle}
        data-capturing={isCameraActive && !imageDataUrl}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "object-cover w-full h-full transform scaleX-[-1]",
            { 'hidden': !isCameraActive || !!imageDataUrl }
          )}
        />
        {imageDataUrl && (
          <img src={imageDataUrl} alt="Captured face" className="object-cover w-full h-full absolute inset-0" />
        )}
        {!isCameraActive && !imageDataUrl && !isStartingCamera && (
          <div className="flex flex-col items-center justify-center w-full h-full text-muted-foreground absolute inset-0">
            <VideoOff size={imageSize / 4} />
            <p className="mt-2 text-sm">{error ? "Camera Error" : (isStartingCamera ? "Initializing..." : "Camera Off")}</p>
          </div>
        )}
         {isStartingCamera && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-2 text-sm text-foreground">Starting camera...</p>
            </div>
         )}
      </div>

      {error && !isCameraActive && (
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle size={20} />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="flex gap-2 w-full">
        {!isCameraActive && !imageDataUrl && !isStartingCamera && (
           <Button onClick={startCamera} className="w-full" variant="outline">
            <Camera size={18} className="mr-2" />
            Start Camera
          </Button>
        )}
      
        {isCameraActive && !imageDataUrl && (
          <Button onClick={captureFace} disabled={isTakingPicture} className="w-full bg-accent hover:bg-accent/90">
            {isTakingPicture ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Camera size={18} className="mr-2" />}
            {isTakingPicture ? 'Capturing...' : captureButtonText}
          </Button>
        )}
      </div>

      {imageDataUrl && (
        <div className="flex gap-2 w-full">
          <Button onClick={handleRetake} variant="outline" className="flex-1">
            <RefreshCw size={18} className="mr-2" />
            Retake
          </Button>
          <Button onClick={handleConfirm} className="flex-1">
            <CheckCircle2 size={18} className="mr-2" />
            Confirm Photo
          </Button>
        </div>
      )}
    </div>
  );
};

export default FaceCapture;
