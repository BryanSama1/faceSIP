
"use client";

import type { User } from '@/types';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import useLocalStorage from '@/hooks/use-local-storage';
import { enhanceFaceImage, EnhanceFaceImageInput } from '@/ai/flows/enhance-face-image';
import { useToast } from '@/hooks/use-toast';
import * as faceapi from 'face-api.js';

interface AuthContextType {
  user: User | null;
  users: User[];
  loading: boolean;
  loginWithFace: (capturedFaceUri: string, capturedFaceDescriptor: number[] | null) => Promise<boolean>;
  signup: (name: string, email: string, faceImageUri: string, faceDescriptor: number[] | null) => Promise<boolean>;
  logout: () => void;
  updateUserFaceAdmin: (userId: string, newFaceImageUri: string, newFaceDescriptor: number[] | null) => Promise<boolean>;
  enhanceAndSetFace: (photoDataUri: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const FACE_MATCH_THRESHOLD = 0.55; 

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [users, setUsers] = useLocalStorage<User[]>('users', []);
  const [currentUser, setCurrentUser] = useLocalStorage<User | null>('currentUser', null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    setLoading(false);
  }, [currentUser]);

  const enhanceAndSetFace = async (photoDataUri: string): Promise<string | null> => {
    try {
      const input: EnhanceFaceImageInput = { photoDataUri };
      const result = await enhanceFaceImage(input);
      return result.enhancedPhotoDataUri;
    } catch (error) {
      console.error("Error enhancing face image:", error);
      return null;
    }
  };

  const loginWithFace = async (capturedFaceUri: string, capturedFaceDescriptor: number[] | null): Promise<boolean> => {
    setLoading(true);

    if (users.length === 0) {
      toast({ title: "Inicio de Sesión Fallido", description: "No hay usuarios registrados. Por favor, regístrate.", variant: "destructive" });
      setLoading(false);
      return false;
    }

    if (!capturedFaceDescriptor) {
      toast({ title: "Inicio de Sesión Fallido", description: "No se pudieron procesar los rasgos faciales para el inicio de sesión. Intenta capturar tu rostro de nuevo.", variant: "destructive" });
      setLoading(false);
      return false;
    }
    
    const enhancedLoginFaceUri = await enhanceAndSetFace(capturedFaceUri);
    if (!enhancedLoginFaceUri) {
      toast({ title: "Inicio de Sesión Fallido", description: "No se pudo procesar el rostro capturado para el reconocimiento. Asegúrate de que tu rostro esté claro y bien iluminado.", variant: "destructive" });
      setLoading(false);
      return false;
    }


    const labeledFaceDescriptors = users
      .filter(user => user.faceDescriptor && user.faceDescriptor.length > 0)
      .map(user => new faceapi.LabeledFaceDescriptors(
        user.id, 
        [new Float32Array(user.faceDescriptor!)]
      ));

    if (labeledFaceDescriptors.length === 0) {
        toast({ title: "Inicio de Sesión Fallido", description: "Ningún usuario registrado tiene descriptores faciales para comparación. Vuelve a registrarte o contacta al administrador.", variant: "destructive" });
        setLoading(false);
        return false;
    }

    const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, FACE_MATCH_THRESHOLD);
    const bestMatch = faceMatcher.findBestMatch(new Float32Array(capturedFaceDescriptor));

    if (bestMatch && bestMatch.label !== 'unknown') {
      const matchedUser = users.find(u => u.id === bestMatch.label);
      if (matchedUser) {
        setCurrentUser(matchedUser);
        setLoading(false);
        return true;
      } else {
         toast({ title: "Error de Inicio de Sesión", description: "Usuario coincidente no encontrado en el sistema.", variant: "destructive" });
      }
    } else {
      toast({ title: "Inicio de Sesión Fallido", description: "Rostro no reconocido. Asegúrate de ser un usuario registrado e inténtalo de nuevo.", variant: "destructive" });
    }

    setLoading(false);
    return false;
  };

  const signup = async (name: string, email: string, faceImageUri: string, faceDescriptor: number[] | null): Promise<boolean> => {
    setLoading(true);
    if (users.find(u => u.email === email)) {
      setLoading(false);
      toast({title: "Registro Fallido", description: "Ya existe un usuario con este correo electrónico.", variant: "destructive"});
      return false;
    }

    if (!faceDescriptor) {
        setLoading(false);
        toast({title: "Registro Fallido", description: 'No se pudo calcular el descriptor facial. Intenta capturar tu rostro de nuevo.', variant: "destructive"});
        return false;
    }

    const enhancedFaceImageUri = await enhanceAndSetFace(faceImageUri);
    if (!enhancedFaceImageUri) {
      setLoading(false);
      toast({title: "Registro Fallido", description: 'Falló la mejora de la imagen facial. Intenta de nuevo con una imagen más clara.', variant: "destructive"});
      return false;
    }

    const newUser: User = {
      id: Date.now().toString(),
      name,
      email,
      faceImageUri,
      enhancedFaceImageUri,
      faceDescriptor,
      isAdmin: users.length === 0, 
    };
    setUsers([...users, newUser]);
    setCurrentUser(newUser); 
    setLoading(false);
    return true;
  };

  const logout = () => {
    setCurrentUser(null);
  };
  
  const updateUserFaceAdmin = async (userId: string, newFaceImageUri: string, newFaceDescriptor: number[] | null): Promise<boolean> => {
    setLoading(true);
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      setLoading(false);
      toast({title: "Actualización Fallida", description: "Usuario no encontrado.", variant: "destructive"});
      return false;
    }

    if (!newFaceDescriptor) {
        setLoading(false);
        toast({title: "Actualización Fallida", description: 'No se pudo calcular el nuevo descriptor facial. Intenta capturar de nuevo.', variant: "destructive"});
        return false;
    }

    const enhancedUri = await enhanceAndSetFace(newFaceImageUri);
    if (!enhancedUri) {
      setLoading(false);
      toast({title: "Actualización Fallida", description: 'Falló la mejora de la nueva imagen facial. Asegúrate de que la imagen sea clara.', variant: "destructive"});
      return false;
    }

    const updatedUsers = [...users];
    updatedUsers[userIndex] = {
      ...updatedUsers[userIndex],
      faceImageUri: newFaceImageUri, 
      enhancedFaceImageUri: enhancedUri, 
      faceDescriptor: newFaceDescriptor,
    };
    setUsers(updatedUsers);
    
    if (currentUser?.id === userId) {
      setCurrentUser(updatedUsers[userIndex]);
    }

    setLoading(false);
    return true;
  };


  return (
    <AuthContext.Provider value={{ user: currentUser, users, loading, loginWithFace, signup, logout, updateUserFaceAdmin, enhanceAndSetFace }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};
