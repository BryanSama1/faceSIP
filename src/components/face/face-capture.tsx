"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RefreshCw, CheckCircle2, AlertTriangle, VideoOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  const [isCapturing, setIsCapturing] = useState(false);
  const { toast } = useToast();

  const startCamera = useCallback(async () => {
    setError(null);
    setImageDataUrl(null);
    setIsCapturing(true);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: imageSize, height: imageSize } });
        setStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } else {
        setError("Camera access not supported by your browser.");
        toast({ title: "Error", description: "Camera access not supported.", variant: "destructive" });
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
    } finally {
      setIsCapturing(false);
    }
  }, [toast, imageSize]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  useEffect(() => {
    // Start camera automatically when component mounts
    // startCamera();
    // Cleanup: stop camera when component unmounts
    return () => {
      stopCamera();
    };
  }, [stopCamera]); // Removed startCamera from dependencies to avoid re-triggering on every render

  const captureFace = () => {
    if (videoRef.current && canvasRef.current) {
      setIsCapturing(true);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        // Flip the image horizontally for a mirror effect if desired
        // context.translate(video.videoWidth, 0);
        // context.scale(-1, 1);
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUrl = canvas.toDataURL('image/png');
        setImageDataUrl(dataUrl);
        // stopCamera(); // Stop camera after capture
      }
      setIsCapturing(false);
    }
  };

  const handleConfirm = () => {
    if (imageDataUrl) {
      onFaceCaptured(imageDataUrl);
      stopCamera(); // Stop camera after confirming
    }
  };

  const handleRetake = () => {
    setImageDataUrl(null);
    if (!stream) { // If stream was stopped, restart it
      startCamera();
    }
  };

  const previewStyle = { width: `${imageSize}px`, height: `${imageSize}px` };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md">
      <div 
        className="relative rounded-lg overflow-hidden border-2 border-dashed border-primary animate-pulse-border bg-muted"
        style={previewStyle}
      >
        {imageDataUrl ? (
          <img src={imageDataUrl} alt="Captured face" className="object-cover w-full h-full" />
        ) : stream ? (
          <video ref={videoRef} autoPlay playsInline className="object-cover w-full h-full transform scaleX-[-1]" />
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full text-muted-foreground">
            <VideoOff size={imageSize / 4} />
            <p className="mt-2 text-sm">{error ? "Camera Error" : "Camera Off"}</p>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle size={20} />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="flex gap-2 w-full">
        {!stream && !imageDataUrl && (
           <Button onClick={startCamera} disabled={isCapturing} className="w-full" variant="outline">
            <Camera size={18} className="mr-2" />
            {isCapturing ? 'Starting Camera...' : 'Start Camera'}
          </Button>
        )}

        {stream && !imageDataUrl && (
          <Button onClick={captureFace} disabled={isCapturing} className="w-full bg-accent hover:bg-accent/90">
            <Camera size={18} className="mr-2" />
            {isCapturing ? 'Capturing...' : captureButtonText}
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
