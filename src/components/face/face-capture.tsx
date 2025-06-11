
"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RefreshCw, CheckCircle2, AlertTriangle, VideoOff, Loader2, ScanFace } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import * as faceapi from 'face-api.js';

interface FaceCaptureProps {
  onFaceCaptured: (dataUrl: string) => void;
  captureButtonText?: string;
  imageSize?: number; 
}

const FaceCapture: React.FC<FaceCaptureProps> = ({ 
  onFaceCaptured, 
  captureButtonText = "Capture Face",
  imageSize = 300 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // For taking the snapshot
  const detectionCanvasRef = useRef<HTMLCanvasElement>(null); // For drawing real-time detections
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isTakingPicture, setIsTakingPicture] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState<string>("Loading models...");
  
  const { toast } = useToast();

  const streamRef = useRef(stream);
  const isCameraActiveRef = useRef(isCameraActive);
  const cameraOperationInProgress = useRef(false);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  useEffect(() => {
    isCameraActiveRef.current = isCameraActive;
  }, [isCameraActive]);

  const loadModels = useCallback(async () => {
    const MODEL_URL = '/models';
    setDetectionStatus("Loading detection models...");
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        // To draw landmarks, uncomment and add the model to public/models
        // faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL), 
      ]);
      setModelsLoaded(true);
      setDetectionStatus("Models loaded. Ready for detection.");
      console.log("FaceCapture: Models loaded successfully.");
    } catch (e) {
      console.error("FaceCapture: Error loading models: ", e);
      setError("Failed to load face detection models. Detection overlay will not be available.");
      setDetectionStatus("Error loading models.");
      toast({ title: "Model Load Error", description: "Could not load face detection models. Real-time detection unavailable.", variant: "destructive"});
    }
  }, [toast]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const stopCamera = useCallback(() => {
    console.log("FaceCapture: stopCamera called.");
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (detectionCanvasRef.current) {
      const context = detectionCanvasRef.current.getContext('2d');
      context?.clearRect(0, 0, detectionCanvasRef.current.width, detectionCanvasRef.current.height);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      console.log("FaceCapture: Media stream tracks stopped.");
    }
    setStream(null);
    setIsCameraActive(false);
  }, []);

  const startDetection = useCallback(() => {
    if (!videoRef.current || !detectionCanvasRef.current || !modelsLoaded || !isCameraActiveRef.current) {
      return;
    }
    console.log("FaceCapture: Starting real-time detection interval.");

    const video = videoRef.current;
    const canvas = detectionCanvasRef.current;
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);

    detectionIntervalRef.current = setInterval(async () => {
      if (video.paused || video.ended || !isCameraActiveRef.current) {
        if(detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
        return;
      }
      
      const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 }));
      // To draw landmarks:
      // const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 })).withFaceLandmarks(true);


      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      const context = canvas.getContext('2d');
      if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, resizedDetections);
        // To draw landmarks:
        // faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
      }
    }, 200); // Adjust interval as needed for performance
  }, [modelsLoaded]);


  const startCamera = useCallback(async () => {
    if (cameraOperationInProgress.current) return;
    if (isCameraActiveRef.current && streamRef.current) return;

    cameraOperationInProgress.current = true;
    setError(null);
    setImageDataUrl(null);
    setIsStartingCamera(true);
    setIsCameraActive(false);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: imageSize, height: imageSize } });
        setStream(mediaStream);
      } else {
        const msg = "Camera access not supported by your browser.";
        setError(msg); toast({ title: "Error", description: msg, variant: "destructive" });
        setIsStartingCamera(false); cameraOperationInProgress.current = false;
      }
    } catch (err) {
      let message = "Error accessing camera.";
      if (err instanceof Error) { /* ... error handling ... */ }
      setError(message); toast({ title: "Camera Error", description: message, variant: "destructive" });
      setStream(null); setIsStartingCamera(false); cameraOperationInProgress.current = false;
    }
  }, [imageSize, toast]);

  useEffect(() => {
    if (!imageDataUrl && !isCameraActive && !stream && !isStartingCamera && !error) {
      startCamera();
    }
  }, [imageDataUrl, isCameraActive, stream, isStartingCamera, error, startCamera]);

  useEffect(() => {
    const videoNode = videoRef.current;
    if (videoNode && stream) {
      videoNode.srcObject = stream;
      videoNode.onloadedmetadata = () => { // Ensure metadata is loaded for videoWidth/Height
        videoNode.play()
          .then(() => {
            setIsCameraActive(true);
            setIsStartingCamera(false); 
            setError(null);
            cameraOperationInProgress.current = false;
            if (modelsLoaded) startDetection(); // Start detection after video plays
          })
          .catch(playError => {
            let message = "Could not start video playback.";
            setError(message); toast({ title: "Camera Playback Error", description: message, variant: "destructive" });
            setIsCameraActive(false); setIsStartingCamera(false); cameraOperationInProgress.current = false;
            stopCamera(); 
          });
      };
    } else if (videoNode && !stream) {
      videoNode.srcObject = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, modelsLoaded]); // Added modelsLoaded to re-trigger if models load after stream

  useEffect(() => {
    return () => {
      stopCamera();
      if (cameraOperationInProgress.current) cameraOperationInProgress.current = false;
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
        context.translate(video.videoWidth, 0);
        context.scale(-1, 1);
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        context.setTransform(1, 0, 0, 1, 0, 0); 
      }
      const dataUrl = canvas.toDataURL('image/png');
      setImageDataUrl(dataUrl);
      setIsTakingPicture(false);
      // Optionally stop detection here if preferred, or keep it running for retake
      // if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
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
    if (detectionIntervalRef.current) { // Clear old interval if any
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (!isCameraActiveRef.current && !cameraOperationInProgress.current) { 
      startCamera();
    } else if (isCameraActiveRef.current && modelsLoaded) {
      startDetection(); // Restart detection if camera is already active
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
            "object-cover w-full h-full transform scaleX-[-1]",
            { 'hidden': !showVideoFeed }
          )}
          onPlay={() => { // Moved startDetection to onPlay to ensure video is ready
            console.log("FaceCapture: Video onPlay event.");
            if (modelsLoaded && isCameraActiveRef.current && !detectionIntervalRef.current) {
              startDetection();
            }
          }}
        />
        <canvas 
            ref={detectionCanvasRef} 
            className="absolute top-0 left-0 w-full h-full object-cover transform scaleX-[-1]" // Mirrored like the video
            style={previewStyle} 
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
            {!modelsLoaded && detectionStatus && <p className="text-xs text-muted-foreground mt-1">{detectionStatus}</p>}
          </div>
        )}
        {showVideoFeed && !modelsLoaded && detectionStatus && (
            <div className="absolute bottom-2 left-2 right-2 bg-black/50 text-white text-xs p-1 rounded text-center">
                <Loader2 className="inline-block h-3 w-3 mr-1 animate-spin" />
                {detectionStatus}
            </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden"></canvas> {/* For snapshot */}


      {(showErrorMessage || showCameraOffMessage) && (
         <Button onClick={startCamera} className="w-full" variant="outline" disabled={isStartingCamera || cameraOperationInProgress.current}>
          {(isStartingCamera || cameraOperationInProgress.current) ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Camera size={18} className="mr-2" />}
          {(isStartingCamera || cameraOperationInProgress.current) ? "Starting..." : (error ? "Retry Camera" : "Start Camera")}
        </Button>
      )}
      
      {showVideoFeed && (
        <Button onClick={captureFace} disabled={isTakingPicture || !modelsLoaded} className="w-full bg-accent hover:bg-accent/90">
          {isTakingPicture ? <Loader2 size={18} className="mr-2 animate-spin" /> : <ScanFace size={18} className="mr-2" />}
          {isTakingPicture ? 'Capturing...' : (modelsLoaded ? captureButtonText : 'Loading Detector...')}
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
