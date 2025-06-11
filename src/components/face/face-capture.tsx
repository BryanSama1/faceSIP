
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

  const streamRef = useRef(stream);
  const isCameraActiveRef = useRef(isCameraActive);
  const cameraOperationInProgress = useRef(false); // Guard against re-entrant startCamera calls

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  useEffect(() => {
    isCameraActiveRef.current = isCameraActive;
  }, [isCameraActive]);

  const stopCamera = useCallback(() => {
    console.log("FaceCapture: stopCamera called.");
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      console.log("FaceCapture: Media stream tracks stopped.");
    }
    setStream(null);
    setIsCameraActive(false);
    // If an operation was in progress, it's now stopped.
    if (cameraOperationInProgress.current) {
        // cameraOperationInProgress.current = false; // This might be reset too early if stopCamera is called during an error path that also resets it.
                                                // Let specific start/play paths manage this flag.
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (cameraOperationInProgress.current) {
      console.log("FaceCapture: startCamera skipped, camera operation already in progress (ref).");
      return;
    }
    if (isCameraActiveRef.current && streamRef.current) {
      console.log("FaceCapture: startCamera skipped, camera is already active with a stream.");
      return;
    }

    cameraOperationInProgress.current = true;
    console.log("FaceCapture: Attempting to start camera...");
    setError(null);
    setImageDataUrl(null);
    setIsStartingCamera(true);
    setIsCameraActive(false);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: imageSize, height: imageSize } });
        console.log("FaceCapture: Media stream acquired.");
        setStream(mediaStream);
        // cameraOperationInProgress will be set to false by the video.play() effect or getUserMedia catch.
      } else {
        const msg = "Camera access not supported by your browser.";
        console.error("FaceCapture: " + msg);
        setError(msg);
        toast({ title: "Error", description: msg, variant: "destructive" });
        setIsStartingCamera(false);
        setIsCameraActive(false);
        cameraOperationInProgress.current = false;
      }
    } catch (err) {
      console.error("FaceCapture: Error accessing camera: ", err);
      let message = "Error accessing camera. Please ensure permissions are granted.";
      if (err instanceof Error) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          message = "Camera permission denied. Please enable it in your browser settings.";
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          message = "No camera found. Please ensure a camera is connected.";
        } else if (err.name === "NotReadableError") {
            message = "Camera is already in use by another application or browser tab.";
        }
      }
      setError(message);
      toast({ title: "Camera Error", description: message, variant: "destructive" });
      setStream(null);
      setIsStartingCamera(false);
      setIsCameraActive(false);
      cameraOperationInProgress.current = false;
    }
  }, [imageSize, toast]);

  // Effect for auto-starting camera once on mount if conditions are met
  useEffect(() => {
    // Access initial states directly for the first check
    if (!imageDataUrl && !isCameraActive && !stream && !isStartingCamera && !error) {
      console.log("FaceCapture: Auto-starting camera on initial mount.");
      startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs once on mount

  // Effect to handle stream assignment and playback
  useEffect(() => {
    if (videoRef.current && stream) {
      console.log("FaceCapture: Stream available. Assigning to video element and attempting to play.");
      videoRef.current.srcObject = stream;
      videoRef.current.play()
        .then(() => {
          console.log("FaceCapture: Video play success.");
          setIsCameraActive(true);
          setIsStartingCamera(false); 
          setError(null);
          cameraOperationInProgress.current = false;
        })
        .catch(playError => {
          console.error("FaceCapture: Video play() failed:", playError);
          let message = "Could not start video playback.";
          if (playError.name === "NotAllowedError") {
            message = "Video autoplay was prevented. Try clicking 'Start Camera'.";
          } else if (playError.name === "AbortError") {
             // This specific error "The play() request was interrupted by a new load request" means the video load was interrupted.
            // It might be due to rapid re-renders or component unmounting/remounting.
            message = "Video playback was aborted. The camera might have been interrupted.";
          } else if (playError.name === "NotSupportedError") {
            message = "The video format or source is not supported.";
          } else {
            message = `Camera playback error: ${playError.message}`;
          }
          setError(message);
          toast({ title: "Camera Playback Error", description: message, variant: "destructive" });
          setIsCameraActive(false);
          setIsStartingCamera(false);
          cameraOperationInProgress.current = false;
          stopCamera(); 
        });
    } else if (videoRef.current && !stream) {
      console.log("FaceCapture: Stream is null. Clearing video srcObject.");
      videoRef.current.srcObject = null;
    }
  }, [stream, stopCamera, toast]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      console.log("FaceCapture: Component unmounting, ensuring camera is stopped.");
      stopCamera();
      if (cameraOperationInProgress.current) { // Ensure flag is reset on unmount if operation was pending
        cameraOperationInProgress.current = false;
      }
    };
  }, [stopCamera]);

  const captureFace = () => {
    if (videoRef.current && canvasRef.current && stream && isCameraActive) {
      setIsTakingPicture(true);
      console.log("FaceCapture: Capturing face...");
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        // Mirror the captured image to match the preview
        context.translate(video.videoWidth, 0);
        context.scale(-1, 1);
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        // Reset transformation for future drawings if any
        context.setTransform(1, 0, 0, 1, 0, 0); 
      }
      const dataUrl = canvas.toDataURL('image/png');
      setImageDataUrl(dataUrl);
      console.log("FaceCapture: Face captured.");
      setIsTakingPicture(false);
      // stopCamera(); // Keep camera active for retake by default
    } else if (!isCameraActive) {
        toast({ title: "Camera Off", description: "Please start the camera first.", variant: "destructive" });
    }
  };

  const handleConfirm = () => {
    if (imageDataUrl) {
      console.log("FaceCapture: Confirming photo.");
      onFaceCaptured(imageDataUrl);
      stopCamera(); 
    }
  };

  const handleRetake = () => {
    console.log("FaceCapture: Retaking photo.");
    setImageDataUrl(null);
    setError(null);
    if (!isCameraActiveRef.current && !cameraOperationInProgress.current) { 
      console.log("FaceCapture: Camera not active for retake, starting camera.");
      startCamera();
    } else if (isCameraActiveRef.current) {
      console.log("FaceCapture: Camera already active for retake.");
    } else {
      console.log("FaceCapture: Camera starting or operation in progress, retake will use existing process.");
    }
  };
  
  const previewStyle = { width: `${imageSize}px`, height: `${imageSize}px` };
  const showStartingCameraMessage = isStartingCamera && !isCameraActive && !imageDataUrl;
  const showVideoFeed = isCameraActive && !imageDataUrl;
  const showCameraOffMessage = !isCameraActive && !imageDataUrl && !isStartingCamera && !error;
  const showErrorMessage = error && !isCameraActive && !imageDataUrl;

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md">
      <div 
        className="relative rounded-lg overflow-hidden border-2 border-dashed border-primary bg-muted data-[capturing=true]:animate-pulse-border"
        style={previewStyle}
        data-capturing={showVideoFeed && !isTakingPicture}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "object-cover w-full h-full transform scaleX-[-1]", // Mirror preview
            { 'hidden': !showVideoFeed }
          )}
          onCanPlay={() => console.log("FaceCapture: Video onCanPlay event fired.")}
          onLoadedData={() => console.log("FaceCapture: Video onLoadedData event fired.")}
          onPlaying={() => console.log("FaceCapture: Video onPlaying event fired.")}
        />
        {imageDataUrl && (
          <img src={imageDataUrl} alt="Captured face" className="object-cover w-full h-full absolute inset-0" />
        )}
        {showStartingCameraMessage && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 p-4 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-2 text-sm text-foreground">Starting camera...</p>
            </div>
         )}
        {(showCameraOffMessage || showErrorMessage) && (
          <div className="flex flex-col items-center justify-center w-full h-full text-muted-foreground absolute inset-0 p-4 text-center">
            <VideoOff size={imageSize / 4} className="mb-2" />
            {showErrorMessage && <p className="text-sm text-destructive">{error}</p>}
            {showCameraOffMessage && <p className="text-sm">Camera is off or unavailable.</p>}
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden"></canvas>

      {(showErrorMessage || showCameraOffMessage) && (
         <Button onClick={startCamera} className="w-full" variant="outline" disabled={isStartingCamera || cameraOperationInProgress.current}>
          {(isStartingCamera || cameraOperationInProgress.current) ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Camera size={18} className="mr-2" />}
          {(isStartingCamera || cameraOperationInProgress.current) ? "Starting..." : (error ? "Retry Camera" : "Start Camera")}
        </Button>
      )}
      
      {showVideoFeed && (
        <Button onClick={captureFace} disabled={isTakingPicture} className="w-full bg-accent hover:bg-accent/90">
          {isTakingPicture ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Camera size={18} className="mr-2" />}
          {isTakingPicture ? 'Capturing...' : captureButtonText}
        </Button>
      )}

      {imageDataUrl && (
        <div className="flex gap-2 w-full">
          <Button onClick={handleRetake} variant="outline" className="flex-1" disabled={cameraOperationInProgress.current || isStartingCamera}>
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
