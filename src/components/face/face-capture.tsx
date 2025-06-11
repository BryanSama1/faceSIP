
"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RefreshCw, CheckCircle2, AlertTriangle, VideoOff, Loader2, ScanFace } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import * as faceapi from 'face-api.js';

interface FaceCaptureProps {
  onFaceCaptured: (dataUrl: string, descriptor: number[] | null) => void;
  captureButtonText?: string;
  imageSize?: number;
}

const FaceCapture: React.FC<FaceCaptureProps> = ({
  onFaceCaptured,
  captureButtonText = "Capturar Rostro",
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
  const [descriptorModelsLoaded, setDescriptorModelsLoaded] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState<string>("Inicializando...");
  const [isFaceDetectedInPreview, setIsFaceDetectedInPreview] = useState(false);


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
    setDetectionStatus("Cargando modelos de detección facial...");
    console.log(`FaceCapture: Attempting to load models from base URL: ${MODEL_URL}`);
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      setModelsLoaded(true);
      setDetectionStatus("Modelos de detección cargados. Cargando modelos de reconocimiento...");
      console.log("FaceCapture: TinyFaceDetector models loaded successfully.");

      await Promise.all([
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
      setDescriptorModelsLoaded(true);
      setDetectionStatus("Todos los modelos cargados. Listo para detección y reconocimiento facial.");
      console.log("FaceCapture: Landmark and Recognition models loaded successfully.");

    } catch (e) {
      console.error("FaceCapture: Error loading models: ", e);
      const errorMsg = `No se pudieron cargar los modelos faciales. Los archivos de manifiesto como 'tiny_face_detector_model-weights_manifest.json', 'face_landmark_68_model-weights_manifest.json', o 'face_recognition_model-weights_manifest.json' (y sus fragmentos) podrían faltar en '${MODEL_URL}/'. La detección de rostros en tiempo real y la extracción de descriptores NO funcionarán. Asegúrate de que los archivos de modelo estén en 'public/models/'. Revisa la pestaña Red del navegador por errores 404.`;
      setError(errorMsg);
      setDetectionStatus(`Error: Modelos no encontrados. Revisa 'public/models/' y la pestaña Red por errores 404 en archivos de manifiesto de modelos. Detalles en consola.`);
      toast({
        title: "Error en Modelos Faciales (Probable 404)",
        description: `No se pudieron cargar todos los modelos de face-api.js requeridos desde ${MODEL_URL}/. Asegúrate de que 'tiny_face_detector_model', 'face_landmark_68_model', y 'face_recognition_model' (manifiestos y fragmentos) estén en el directorio 'public/models/' de tu proyecto. Revisa la pestaña Red del navegador para detalles. Las funciones de procesamiento facial estarán limitadas.`,
        variant: "destructive",
        duration: 20000
      });
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
    setIsFaceDetectedInPreview(false);
  }, []);

  const startDetection = useCallback(() => {
    if (!videoRef.current || !detectionCanvasRef.current || !modelsLoaded || !isCameraActiveRef.current) {
      return;
    }
    console.log("FaceCapture: Starting real-time detection interval.");

    const video = videoRef.current;
    const canvas = detectionCanvasRef.current;
    const displaySize = { width: video.videoWidth, height: video.videoHeight };

    if (displaySize.width === 0 || displaySize.height === 0) {
        console.warn("FaceCapture: Video dimensions are zero, cannot start detection yet.");
        return;
    }

    faceapi.matchDimensions(canvas, displaySize);

    detectionIntervalRef.current = setInterval(async () => {
      if (video.paused || video.ended || !isCameraActiveRef.current) {
        if(detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
        setIsFaceDetectedInPreview(false);
        return;
      }

      const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 }));
      setIsFaceDetectedInPreview(detections.length > 0);

      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      const context = canvas.getContext('2d');
      if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, resizedDetections);
      }
    }, 200);
  }, [modelsLoaded]);


  const startCamera = useCallback(async () => {
    console.log("FaceCapture: Attempting to start camera. In progress:", cameraOperationInProgress.current, "Active:", isCameraActiveRef.current);
    if (cameraOperationInProgress.current) {
      console.log("FaceCapture: Camera operation already in progress, skipping.");
      return;
    }
    if (isCameraActiveRef.current && streamRef.current) {
      console.log("FaceCapture: Camera already active and stream exists, skipping.");
      return;
    }

    cameraOperationInProgress.current = true;
    setError(null);
    setImageDataUrl(null);
    setIsStartingCamera(true);
    setIsCameraActive(false);
    setIsFaceDetectedInPreview(false);
    console.log("FaceCapture: Set isStartingCamera to true.");

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: imageSize, height: imageSize } });
        console.log("FaceCapture: Got user media stream.");
        setStream(mediaStream);
      } else {
        const msg = "El acceso a la cámara no es compatible con tu navegador.";
        setError(msg); toast({ title: "Error", description: msg, variant: "destructive" });
        setIsStartingCamera(false); cameraOperationInProgress.current = false;
        console.error("FaceCapture: " + msg);
      }
    } catch (err) {
      let message = "Error al acceder a la cámara. Asegúrate de que los permisos estén concedidos.";
      if (err instanceof Error) {
        message = `Error al acceder a la cámara: ${err.name} - ${err.message}. Asegúrate de que los permisos estén concedidos.`;
        if (err.name === "NotAllowedError") {
          message = "Acceso a la cámara denegado. Habilita los permisos de cámara en la configuración de tu navegador.";
        } else if (err.name === "NotFoundError") {
          message = "No se encontró cámara. Asegúrate de que una cámara esté conectada y habilitada.";
        }
      }
      setError(message); toast({ title: "Error de Cámara", description: message, variant: "destructive" });
      setStream(null); setIsCameraActive(false); setIsStartingCamera(false); cameraOperationInProgress.current = false;
      console.error("FaceCapture: " + message, err);
    }
  }, [imageSize, toast]);

  useEffect(() => {
    if (!imageDataUrl && !isCameraActiveRef.current && !streamRef.current && !cameraOperationInProgress.current && !error) {
      console.log("FaceCapture: Auto-starting camera via useEffect.");
      startCamera();
    }
  }, [imageDataUrl, error, startCamera]);


  useEffect(() => {
    const videoNode = videoRef.current;
    if (videoNode && stream) {
      console.log("FaceCapture: Stream available, assigning to video element.");
      videoNode.srcObject = stream;
      videoNode.onloadedmetadata = () => {
        console.log("FaceCapture: Video metadata loaded. Video dimensions:", videoNode.videoWidth, videoNode.videoHeight);
        videoNode.play()
          .then(() => {
            console.log("FaceCapture: Video playback started successfully.");
            setIsCameraActive(true);
            setIsStartingCamera(false);
            setError(null);
            cameraOperationInProgress.current = false;
            if (modelsLoaded) startDetection();
          })
          .catch(playError => {
            console.error("FaceCapture: Error playing video stream:", playError);
            let message = "No se pudo iniciar la reproducción de video. Asegúrate de que el navegador permita la reproducción automática o intenta iniciar manualmente.";
            if (playError instanceof Error && playError.name === "NotAllowedError") {
              message = "Reproducción de video no permitida por el navegador. Por favor, haz clic en 'Iniciar Cámara'.";
            } else if (playError instanceof Error && (playError.message.includes("interrupted") || playError.name === "AbortError") ) {
                message = "Reproducción de video interrumpida. Esto puede suceder con reinicios rápidos de la cámara o si los modelos aún se están cargando. Intenta de nuevo en un momento o haz clic en 'Reintentar Cámara'.";
            }
            setError(message); toast({ title: "Error de Reproducción de Cámara", description: message, variant: "destructive" });
            setIsCameraActive(false); setIsStartingCamera(false); cameraOperationInProgress.current = false;
            stopCamera();
          });
      };
      videoNode.onerror = (e) => {
        console.error("FaceCapture: Video element error:", e);
        setError("Ocurrió un error con el flujo de video.");
        setIsCameraActive(false); setIsStartingCamera(false); cameraOperationInProgress.current = false;
        stopCamera();
      };
    } else if (videoNode && !stream) {
      console.log("FaceCapture: Stream is null, clearing video srcObject.");
      videoNode.srcObject = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, modelsLoaded, stopCamera, toast]); // startDetection removed from here to be called explicitly

   useEffect(() => {
    if (isCameraActive && modelsLoaded && !detectionIntervalRef.current) {
      startDetection();
    }
  }, [isCameraActive, modelsLoaded, startDetection]);


  useEffect(() => {
    return () => {
      console.log("FaceCapture: Component unmounting, stopping camera.");
      stopCamera();
      if (cameraOperationInProgress.current) cameraOperationInProgress.current = false;
    };
  }, [stopCamera]);

  const captureFace = async () => {
    if (videoRef.current && canvasRef.current && stream && isCameraActive && isFaceDetectedInPreview) {
      setIsTakingPicture(true);
      const video = videoRef.current;
      const captureCanvas = canvasRef.current;
      captureCanvas.width = video.videoWidth;
      captureCanvas.height = video.videoHeight;
      const context = captureCanvas.getContext('2d');
      if (context) {
        context.translate(video.videoWidth, 0);
        context.scale(-1, 1); // Mirror the snapshot
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        context.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
      }
      const dataUrl = captureCanvas.toDataURL('image/png');
      setImageDataUrl(dataUrl);

      let descriptor: number[] | null = null;
      if (descriptorModelsLoaded) {
        try {
          const img = document.createElement('img');
          img.src = dataUrl;
          await new Promise((resolve, reject) => { 
            img.onload = resolve;
            img.onerror = reject;
          });

          const detectionResult = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
                                              .withFaceLandmarks()
                                              .withFaceDescriptor();
          if (detectionResult) {
            descriptor = Array.from(detectionResult.descriptor); 
            console.log("FaceCapture: Descriptor computed successfully.");
          } else {
            console.warn("FaceCapture: Could not compute descriptor, face not detected in captured image.");
            toast({title: "Advertencia de Descriptor", description: "No se pudo calcular el descriptor facial de la imagen capturada. Intenta con una toma más clara.", variant: "default", duration: 5000});
          }
        } catch (descError) {
          console.error("FaceCapture: Error computing descriptor:", descError);
          toast({title: "Error de Descriptor", description: "Falló el cálculo del descriptor facial.", variant: "destructive"});
        }
      } else {
        console.warn("FaceCapture: Descriptor models not loaded, cannot compute descriptor.");
        toast({title: "Modelos Faltantes", description: "Modelos de reconocimiento no cargados. No se puede calcular el descriptor.", variant: "destructive"});
      }
      
      setIsTakingPicture(false);
      onFaceCaptured(dataUrl, descriptor); 
      stopCamera(); 
      
    } else if (!isCameraActive) {
        toast({ title: "Cámara Apagada", description: "Por favor, inicia la cámara primero.", variant: "destructive" });
    } else if (!isFaceDetectedInPreview) {
        toast({ title: "No se Detectó Rostro", description: "Asegúrate de que tu rostro esté claramente visible en el recuadro.", variant: "destructive" });
    }
  };


  const handleRetake = () => {
    setImageDataUrl(null);
    setError(null);
    setIsFaceDetectedInPreview(false);

    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (!isCameraActiveRef.current && !cameraOperationInProgress.current) {
      console.log("FaceCapture: Retake - camera not active, starting camera.");
      startCamera();
    } else if (isCameraActiveRef.current && modelsLoaded) {
      console.log("FaceCapture: Retake - camera active, restarting detection.");
      startDetection();
    } else if (isCameraActiveRef.current && !modelsLoaded) {
        console.log("FaceCapture: Retake - camera active, models not loaded. Detection will not restart.");
    }
  };

  const previewStyle = { width: `${imageSize}px`, height: `${imageSize}px` };

  let previewMessageArea = null;
  if (isStartingCamera && !isCameraActive && !imageDataUrl) {
    previewMessageArea = (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 p-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-2 text-sm text-foreground">Iniciando cámara...</p>
      </div>
    );
  } else if ((!modelsLoaded || !descriptorModelsLoaded) && detectionStatus.startsWith("Error:")) {
    previewMessageArea = (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-destructive/10 p-4 text-center">
        <AlertTriangle size={imageSize / 5} className="mb-2 text-destructive" />
        <p className="text-sm font-semibold text-destructive">Error al Cargar Modelos Faciales</p>
        <p className="text-xs text-destructive/80 mt-1">{detectionStatus.replace("Error: Models not found. Check 'public/models/' and Network tab for 404s on model manifest files. Details in console.", "Error: Modelos no encontrados. Verifica `public/models/` y la pestaña Red del navegador por errores 404 en los archivos de modelos. Revisa la consola para más detalles.")}</p>
        <p className="text-xs text-muted-foreground mt-2">
          Verifica que los archivos de modelo (ej. `tiny_face_detector_model-weights_manifest.json`) estén en `public/models/`. Revisa la pestaña Red del navegador por errores 404.
        </p>
      </div>
    );
  } else if (error && !isCameraActive && !imageDataUrl) {
    previewMessageArea = (
      <div className="flex flex-col items-center justify-center w-full h-full text-muted-foreground absolute inset-0 p-4 text-center">
        <VideoOff size={imageSize / 4} className="mb-2" />
        <p className="text-sm text-destructive">{error}</p>
        {(!modelsLoaded || !descriptorModelsLoaded) && detectionStatus && !detectionStatus.startsWith("Error:") && <p className="text-xs text-muted-foreground mt-1">{detectionStatus}</p>}
      </div>
    );
  } else if (!isCameraActive && !imageDataUrl && !isStartingCamera) {
    previewMessageArea = (
      <div className="flex flex-col items-center justify-center w-full h-full text-muted-foreground absolute inset-0 p-4 text-center">
        <VideoOff size={imageSize / 4} className="mb-2" />
        <p className="text-sm">La cámara está apagada o no disponible.</p>
        {(!modelsLoaded || !descriptorModelsLoaded) && detectionStatus && !detectionStatus.startsWith("Error:") &&  <p className="text-xs text-muted-foreground mt-1">{detectionStatus}</p>}
      </div>
    );
  }


  const showVideoFeed = isCameraActive && !imageDataUrl;
  let captureButtonDynamicText = captureButtonText;
  const allModelsFullyLoaded = modelsLoaded && descriptorModelsLoaded;

  if (showVideoFeed && !allModelsFullyLoaded && !detectionStatus.startsWith("Error:")) {
    captureButtonDynamicText = "Cargando Modelos...";
  } else if (showVideoFeed && !allModelsFullyLoaded && detectionStatus.startsWith("Error:")){
    captureButtonDynamicText = "Faltan Modelos de Detección";
  } else if (showVideoFeed && allModelsFullyLoaded && !isFaceDetectedInPreview) {
    captureButtonDynamicText = "Posiciona el Rostro en el Recuadro";
  }


  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md">
      <div
        className="relative rounded-lg overflow-hidden border-2 border-dashed border-primary bg-muted data-[capturing=true]:animate-pulse-border"
        style={previewStyle}
        data-capturing={showVideoFeed && !isTakingPicture && allModelsFullyLoaded && isFaceDetectedInPreview}
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
          onPlay={() => {
            console.log("FaceCapture: Video onPlay event triggered.");
            if (modelsLoaded && isCameraActiveRef.current && !detectionIntervalRef.current) { 
              startDetection();
            }
          }}
        />
        <canvas
            ref={detectionCanvasRef}
            className={cn(
              "absolute top-0 left-0 w-full h-full object-cover transform scaleX-[-1]",
              { 'hidden': !modelsLoaded || !showVideoFeed } 
            )}
            style={previewStyle}
        />
        {imageDataUrl && (
          <img src={imageDataUrl} alt="Rostro capturado" className="object-cover w-full h-full absolute inset-0" />
        )}

        {previewMessageArea}

        {showVideoFeed && (!allModelsFullyLoaded) && detectionStatus && !detectionStatus.startsWith("Error:") && (
            <div className="absolute bottom-2 left-2 right-2 bg-black/50 text-white text-xs p-1 rounded text-center">
                <Loader2 className="inline-block h-3 w-3 mr-1 animate-spin" />
                {detectionStatus}
            </div>
        )}
         {showVideoFeed && allModelsFullyLoaded && !isFaceDetectedInPreview && !isStartingCamera && !error && (
          <div className="absolute bottom-2 left-2 right-2 bg-amber-500/80 text-white text-xs p-1 rounded text-center font-medium">
            Posiciona tu rostro en el recuadro.
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden"></canvas> 


      {(!isCameraActive && !showVideoFeed && !imageDataUrl) && (
         <Button onClick={startCamera} className="w-full" variant="outline" disabled={isStartingCamera || cameraOperationInProgress.current}>
          {(isStartingCamera || cameraOperationInProgress.current) ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Camera size={18} className="mr-2" />}
          {(isStartingCamera || cameraOperationInProgress.current) ? "Iniciando..." : (error || detectionStatus.startsWith("Error:") ? "Reintentar Cámara" : "Iniciar Cámara")}
        </Button>
      )}

      {showVideoFeed && (
        <Button onClick={captureFace} disabled={isTakingPicture || !allModelsFullyLoaded || !isFaceDetectedInPreview} className="w-full bg-accent hover:bg-accent/90">
          {isTakingPicture ? <Loader2 size={18} className="mr-2 animate-spin" /> : <ScanFace size={18} className="mr-2" />}
          {isTakingPicture ? 'Procesando...' : captureButtonDynamicText}
        </Button>
      )}

      {imageDataUrl && (
        <div className="flex gap-2 w-full">
          <Button onClick={handleRetake} variant="outline" className="w-full" disabled={cameraOperationInProgress.current || isStartingCamera}>
            <RefreshCw size={18} className="mr-2" />
            Tomar de Nuevo
          </Button>
        </div>
      )}
    </div>
  );
};

export default FaceCapture;
