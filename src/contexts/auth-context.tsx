"use client";

import type { User } from '@/types';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import useLocalStorage from '@/hooks/use-local-storage';
import { enhanceFaceImage, EnhanceFaceImageInput } from '@/ai/flows/enhance-face-image';

interface AuthContextType {
  user: User | null;
  users: User[];
  loading: boolean;
  loginWithFace: (email: string, capturedFaceUri: string) => Promise<boolean>;
  signup: (name: string, email: string, faceImageUri: string) => Promise<boolean>;
  logout: () => void;
  updateUserFaceAdmin: (userId: string, newFaceImageUri: string) => Promise<boolean>;
  enhanceAndSetFace: (photoDataUri: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [users, setUsers] = useLocalStorage<User[]>('users', []);
  const [currentUser, setCurrentUser] = useLocalStorage<User | null>('currentUser', null);
  const [loading, setLoading] = useState(true);

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

  const loginWithFace = async (email: string, capturedFaceUri: string): Promise<boolean> => {
    setLoading(true);
    const userToLogin = users.find(u => u.email === email);

    if (userToLogin) {
      // Simulate face comparison. In a real app, you'd compare feature vectors.
      // For this demo, we'll just check if a face was captured.
      // A more robust simulation might "compare" the new capture with the stored enhanced URI.
      // For now, if user exists and face is provided, login succeeds.
      // Let's simulate a delay for "processing"
      await new Promise(resolve => setTimeout(resolve, 1500)); 
      
      // Simulate successful login if face is captured.
      // In a real scenario, you'd use the capturedFaceUri to compare against userToLogin.enhancedFaceImageUri
      if (capturedFaceUri) {
        setCurrentUser(userToLogin);
        setLoading(false);
        return true;
      }
    }
    setLoading(false);
    return false;
  };

  const signup = async (name: string, email: string, faceImageUri: string): Promise<boolean> => {
    setLoading(true);
    if (users.find(u => u.email === email)) {
      setLoading(false);
      alert('User with this email already exists.');
      return false;
    }

    const enhancedFaceImageUri = await enhanceAndSetFace(faceImageUri);
    if (!enhancedFaceImageUri) {
      setLoading(false);
      alert('Failed to enhance face image. Please try again.');
      return false;
    }

    const newUser: User = {
      id: Date.now().toString(),
      name,
      email,
      faceImageUri,
      enhancedFaceImageUri,
      isAdmin: users.length === 0, // First user is admin
    };
    setUsers([...users, newUser]);
    setCurrentUser(newUser); // Auto-login after signup
    setLoading(false);
    return true;
  };

  const logout = () => {
    setCurrentUser(null);
  };
  
  const updateUserFaceAdmin = async (userId: string, newFaceImageUri: string): Promise<boolean> => {
    setLoading(true);
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      setLoading(false);
      return false;
    }

    const enhancedUri = await enhanceAndSetFace(newFaceImageUri);
    if (!enhancedUri) {
      setLoading(false);
      alert('Failed to enhance new face image.');
      return false;
    }

    const updatedUsers = [...users];
    updatedUsers[userIndex] = {
      ...updatedUsers[userIndex],
      faceImageUri: newFaceImageUri,
      enhancedFaceImageUri: enhancedUri,
    };
    setUsers(updatedUsers);
    
    // If the updated user is the current user, update currentUser as well
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
