
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

  // Refs to hold current state values for use in useCallback without causing dependency loops
  const isStartingCameraRef = useRef(isStartingCamera);
  const isCameraActiveRef = useRef(isCameraActive);
  const streamRef = useRef(stream);

  useEffect(() => {
    isStartingCameraRef.current = isStartingCamera;
  }, [isStartingCamera]);

  useEffect(() => {
    isCameraActiveRef.current = isCameraActive;
  }, [isCameraActive]);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  const stopCamera = useCallback(() => {
    console.log("FaceCapture: stopCamera called.");
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      console.log("FaceCapture: Media stream tracks stopped.");
    }
    setStream(null);
    setIsCameraActive(false);
    // setIsStartingCamera(false); // Only set starting to false if it was in a starting process that's now aborted.
                               // Generally, start/stop are distinct actions from the 'starting' phase.
  }, []);


  const startCamera = useCallback(async () => {
    if (isStartingCameraRef.current || (isCameraActiveRef.current && streamRef.current)) {
      console.log("FaceCapture: startCamera skipped, already starting or active with stream.");
      return;
    }

    console.log("FaceCapture: Attempting to start camera...");
    setError(null);
    setImageDataUrl(null);
    setIsStartingCamera(true);
    setIsCameraActive(false); // Explicitly set camera to not active before attempting to start

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: imageSize, height: imageSize } });
        console.log("FaceCapture: Media stream acquired.");
        setStream(mediaStream);
        // setIsStartingCamera will be set to false by the effect that handles video.play()
      } else {
        const msg = "Camera access not supported by your browser.";
        console.error("FaceCapture: " + msg);
        setError(msg);
        toast({ title: "Error", description: msg, variant: "destructive" });
        setIsStartingCamera(false);
        setIsCameraActive(false);
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
    }
  }, [imageSize, toast]); // Removed state refs from here, they are accessed via .current

  // Effect to handle stream assignment and playback
  useEffect(() => {
    if (videoRef.current && stream) {
      console.log("FaceCapture: Stream available. Assigning to video element and attempting to play.");
      videoRef.current.srcObject = stream;
      videoRef.current.play()
        .then(() => {
          console.log("FaceCapture: Video play success.");
          setIsCameraActive(true);
          setIsStartingCamera(false); // Camera is now active, no longer "starting"
          setError(null); // Clear any previous errors
        })
        .catch(playError => {
          console.error("FaceCapture: Video play() failed:", playError);
          let message = "Could not start video playback. Ensure camera is not in use elsewhere.";
          if (playError.name === "NotAllowedError") {
            message = "Video autoplay was prevented by the browser. User interaction might be required, or check site permissions.";
          } else if (playError.name === "AbortError") {
            message = "Video playback was aborted. This can happen if you navigate away or another camera request interrupts it.";
          } else if (playError.name === "NotSupportedError") {
            message = "The video format or source is not supported.";
          }
          setError(message);
          toast({ title: "Camera Playback Error", description: message, variant: "destructive" });
          setIsCameraActive(false);
          setIsStartingCamera(false);
          stopCamera(); // Clean up the stream if play fails
        });
    } else if (videoRef.current && !stream) {
      console.log("FaceCapture: Stream is null. Clearing video srcObject.");
      videoRef.current.srcObject = null;
      // setIsCameraActive(false); // This should be handled by stopCamera or when stream is explicitly set to null
    }
  }, [stream, stopCamera, toast]);

  // Auto-start camera attempt
  useEffect(() => {
    if (!imageDataUrl && !isCameraActiveRef.current && !streamRef.current && !isStartingCameraRef.current && !error) {
      console.log("FaceCapture: Auto-starting camera due to initial conditions.");
      startCamera();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageDataUrl, error, startCamera]); // Dependencies are state triggers for auto-start logic

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      console.log("FaceCapture: Component unmounting, ensuring camera is stopped.");
      stopCamera();
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
        context.translate(video.videoWidth, 0);
        context.scale(-1, 1);
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        context.setTransform(1, 0, 0, 1, 0, 0);
      }
      const dataUrl = canvas.toDataURL('image/png');
      setImageDataUrl(dataUrl);
      console.log("FaceCapture: Face captured.");
      setIsTakingPicture(false);
      // stopCamera(); // Optionally stop camera after capture, or leave for retake
    } else if (!isCameraActive) {
        toast({ title: "Camera Off", description: "Please start the camera first.", variant: "destructive" });
    }
  };

  const handleConfirm = () => {
    if (imageDataUrl) {
      console.log("FaceCapture: Confirming photo.");
      onFaceCaptured(imageDataUrl);
      stopCamera(); // Stop camera after confirming
    }
  };

  const handleRetake = () => {
    console.log("FaceCapture: Retaking photo.");
    setImageDataUrl(null);
    setError(null);
    if (!isCameraActiveRef.current && !isStartingCameraRef.current) { // Use refs here
      console.log("FaceCapture: Camera not active for retake, starting camera.");
      startCamera();
    } else {
      console.log("FaceCapture: Camera already active or starting for retake.");
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
        data-capturing={showVideoFeed}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "object-cover w-full h-full transform scaleX-[-1]",
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
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80">
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
         <Button onClick={startCamera} className="w-full" variant="outline" disabled={isStartingCamera}>
          {isStartingCamera ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Camera size={18} className="mr-2" />}
          {isStartingCamera ? "Starting..." : (error ? "Retry Camera" : "Start Camera")}
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

