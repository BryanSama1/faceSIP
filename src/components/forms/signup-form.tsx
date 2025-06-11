
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import FaceCapture from '@/components/face/face-capture';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Loader2, UserPlus } from 'lucide-react';

export default function SignupForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [capturedFaceUri, setCapturedFaceUri] = useState<string | null>(null);
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const { signup } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleFaceCaptured = (dataUrl: string, descriptor: number[] | null) => {
    setCapturedFaceUri(dataUrl);
    setFaceDescriptor(descriptor);
    if (descriptor) {
      toast({ title: "Rostro Capturado", description: "Tu imagen facial y descriptor han sido procesados." });
    } else {
      toast({ title: "Rostro Capturado (Sin Descriptor)", description: "Imagen facial capturada, pero no se pudo calcular el descriptor. Intenta de nuevo con una imagen más clara para un mejor reconocimiento.", variant: "default", duration: 7000 });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      toast({ title: "Información Faltante", description: "Por favor, completa tu nombre y correo electrónico.", variant: "destructive" });
      return;
    }
    if (!capturedFaceUri) {
      toast({ title: "Se Requiere Captura de Rostro", description: "Por favor, captura tu rostro para el registro.", variant: "destructive" });
      return;
    }
    if (!faceDescriptor) {
      toast({ title: "Falta Descriptor", description: "Descriptor facial no disponible. Por favor, captura tu rostro de nuevo con claridad.", variant: "destructive" });
      return;
    }

    setIsSigningUp(true);
    try {
      const success = await signup(name, email, capturedFaceUri, faceDescriptor);

      if (success) {
        toast({ title: "Registro Exitoso", description: "Tu cuenta ha sido creada. ¡Bienvenido!" });
        router.push('/dashboard');
      } else {
        // Signup failure toasts are handled within the auth context's signup method
      }
    } catch (error) {
      console.error("Signup error:", error);
      toast({ title: "Error de Registro", description: "Ocurrió un error inesperado. Por favor, inténtalo de nuevo.", variant: "destructive" });
    } finally {
      setIsSigningUp(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="name" className="font-medium text-foreground">Nombre Completo</Label>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Juan Pérez"
          required
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="email" className="font-medium text-foreground">Dirección de Correo Electrónico</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@ejemplo.com"
          required
          className="mt-1"
        />
      </div>
      
      <div className="space-y-2">
        <Label className="font-medium text-foreground">Registra Tu Rostro</Label>
        <p className="text-sm text-muted-foreground">
          Esta imagen se usará para iniciar sesión. Asegura buena iluminación y una vista clara de tu rostro.
        </p>
        <FaceCapture onFaceCaptured={handleFaceCaptured} captureButtonText="Capturar Rostro y Obtener Descriptor" />
        {capturedFaceUri && faceDescriptor && <p className="text-xs text-green-600 text-center">¡Rostro y descriptor capturados exitosamente!</p>}
        {capturedFaceUri && !faceDescriptor && <p className="text-xs text-amber-600 text-center">Rostro capturado, pero el descriptor falló. Intenta de nuevo.</p>}
      </div>

      <Button type="submit" disabled={isSigningUp || !capturedFaceUri || !faceDescriptor} className="w-full">
        {isSigningUp ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <UserPlus className="mr-2 h-4 w-4" />
        )}
        {isSigningUp ? 'Creando Cuenta...' : 'Crear Cuenta'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes una cuenta?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Iniciar Sesión
        </Link>
      </p>
    </form>
  );
}
