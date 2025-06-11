
"use client";

import type { User } from '@/types';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import useLocalStorage from '@/hooks/use-local-storage';
import { enhanceFaceImage, EnhanceFaceImageInput } from '@/ai/flows/enhance-face-image';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  users: User[];
  loading: boolean;
  loginWithFace: (capturedFaceUri: string) => Promise<boolean>; // This will change later for live recognition
  signup: (name: string, email: string, faceImageUri: string, faceDescriptor: number[] | null) => Promise<boolean>;
  logout: () => void;
  updateUserFaceAdmin: (userId: string, newFaceImageUri: string, newFaceDescriptor: number[] | null) => Promise<boolean>;
  enhanceAndSetFace: (photoDataUri: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

  const loginWithFace = async (capturedFaceUri: string): Promise<boolean> => {
    setLoading(true);

    if (users.length === 0) {
      toast({ title: "Login Failed", description: "No users are registered. Please sign up.", variant: "destructive" });
      setLoading(false);
      return false;
    }
    
    const enhancedLoginFaceUri = await enhanceAndSetFace(capturedFaceUri);

    if (!enhancedLoginFaceUri) {
      toast({ title: "Login Failed", description: "Could not process the captured face for recognition. Please ensure your face is clear and well-lit.", variant: "destructive" });
      setLoading(false);
      return false;
    }
    
    // SIMULATED LOGIN: For now, logs in the first user if face processing is successful.
    // This will be replaced with actual descriptor comparison later.
    const userToLogin = users[0]; 

    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500)); 

    setCurrentUser(userToLogin);
    setLoading(false);
    return true;
  };

  const signup = async (name: string, email: string, faceImageUri: string, faceDescriptor: number[] | null): Promise<boolean> => {
    setLoading(true);
    if (users.find(u => u.email === email)) {
      setLoading(false);
      toast({title: "Signup Failed", description: "User with this email already exists.", variant: "destructive"});
      return false;
    }

    if (!faceDescriptor) {
        setLoading(false);
        toast({title: "Signup Failed", description: 'Could not compute facial descriptor. Please try capturing your face again.', variant: "destructive"});
        return false;
    }

    const enhancedFaceImageUri = await enhanceAndSetFace(faceImageUri);
    if (!enhancedFaceImageUri) {
      setLoading(false);
      toast({title: "Signup Failed", description: 'Failed to enhance face image. Please try again with a clearer picture.', variant: "destructive"});
      return false;
    }

    const newUser: User = {
      id: Date.now().toString(),
      name,
      email,
      faceImageUri,
      enhancedFaceImageUri,
      faceDescriptor,
      isAdmin: users.length === 0, // First user is admin
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
      toast({title: "Update Failed", description: "User not found.", variant: "destructive"});
      return false;
    }

    if (!newFaceDescriptor) {
        setLoading(false);
        toast({title: "Update Failed", description: 'Could not compute new facial descriptor. Please try capturing again.', variant: "destructive"});
        return false;
    }

    const enhancedUri = await enhanceAndSetFace(newFaceImageUri);
    if (!enhancedUri) {
      setLoading(false);
      toast({title: "Update Failed", description: 'Failed to enhance new face image. Please ensure the image is clear.', variant: "destructive"});
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
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
