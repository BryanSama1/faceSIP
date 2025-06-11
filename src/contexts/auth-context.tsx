
"use client";

import type { User } from '@/types';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import useLocalStorage from '@/hooks/use-local-storage';
import { enhanceFaceImage, EnhanceFaceImageInput } from '@/ai/flows/enhance-face-image';
import { useToast } from '@/hooks/use-toast'; // Import useToast

interface AuthContextType {
  user: User | null;
  users: User[];
  loading: boolean;
  loginWithFace: (capturedFaceUri: string) => Promise<boolean>; // Email removed
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
  const { toast } = useToast(); // Initialize toast

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
      // Toasting here might be too early if called from signup, signup should handle its own UI feedback.
      return null;
    }
  };

  const loginWithFace = async (capturedFaceUri: string): Promise<boolean> => {
    setLoading(true);

    if (users.length === 0) {
      // The form will handle "No users registered" toast.
      // This context method should primarily focus on the logic.
      setLoading(false);
      return false;
    }

    // Simulate face recognition: For this prototype, if a face is captured
    // and users exist, we "log in" the first registered user.
    // This is a placeholder for a real face recognition system.
    const userToLogin = users[0]; // Attempt to log in as the first user (usually admin).

    if (userToLogin && capturedFaceUri) {
      // Simulate a delay for "face processing"
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000)); // 1-2s delay
      
      setCurrentUser(userToLogin);
      setLoading(false);
      return true;
    }
    
    // This path should ideally not be hit if users.length > 0 and capturedFaceUri is valid.
    // If it is, it implies an unexpected issue or that capturedFaceUri became null somehow.
    setLoading(false);
    return false;
  };

  const signup = async (name: string, email: string, faceImageUri: string): Promise<boolean> => {
    setLoading(true);
    if (users.find(u => u.email === email)) {
      setLoading(false);
      toast({title: "Signup Failed", description: "User with this email already exists.", variant: "destructive"});
      return false;
    }

    const enhancedFaceImageUri = await enhanceAndSetFace(faceImageUri);
    if (!enhancedFaceImageUri) {
      setLoading(false);
      toast({title: "Signup Failed", description: 'Failed to enhance face image. Please try again.', variant: "destructive"});
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
     // Optionally, redirect to login page after logout
     // This is typically handled by components checking the user state.
  };
  
  const updateUserFaceAdmin = async (userId: string, newFaceImageUri: string): Promise<boolean> => {
    setLoading(true);
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      setLoading(false);
      toast({title: "Update Failed", description: "User not found.", variant: "destructive"});
      return false;
    }

    const enhancedUri = await enhanceAndSetFace(newFaceImageUri);
    if (!enhancedUri) {
      setLoading(false);
      toast({title: "Update Failed", description: 'Failed to enhance new face image.', variant: "destructive"});
      return false;
    }

    const updatedUsers = [...users];
    updatedUsers[userIndex] = {
      ...updatedUsers[userIndex],
      faceImageUri: newFaceImageUri, // Store original new capture
      enhancedFaceImageUri: enhancedUri, // Store new enhanced image
    };
    setUsers(updatedUsers);
    
    // If the updated user is the current user, update currentUser as well
    if (currentUser?.id === userId) {
      setCurrentUser(updatedUsers[userIndex]);
    }

    setLoading(false);
    // Toast for success is handled in UserManagementTable
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
