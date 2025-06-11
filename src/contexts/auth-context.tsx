
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

const FACE_MATCH_THRESHOLD = 0.55; // Adjusted threshold for potentially better accuracy

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
      // Toast messages are handled by the calling functions
      return null;
    }
  };

  const loginWithFace = async (capturedFaceUri: string, capturedFaceDescriptor: number[] | null): Promise<boolean> => {
    setLoading(true);

    if (users.length === 0) {
      toast({ title: "Login Failed", description: "No users are registered. Please sign up.", variant: "destructive" });
      setLoading(false);
      return false;
    }

    if (!capturedFaceDescriptor) {
      toast({ title: "Login Failed", description: "Could not process face features for login. Please try capturing your face again.", variant: "destructive" });
      setLoading(false);
      return false;
    }

    const enhancedLoginFaceUri = await enhanceAndSetFace(capturedFaceUri);
    if (!enhancedLoginFaceUri) {
      toast({ title: "Login Failed", description: "Could not process the captured face for recognition. Please ensure your face is clear and well-lit.", variant: "destructive" });
      setLoading(false);
      return false;
    }

    // Create LabeledFaceDescriptors for FaceMatcher
    const labeledFaceDescriptors = users
      .filter(user => user.faceDescriptor && user.faceDescriptor.length > 0)
      .map(user => new faceapi.LabeledFaceDescriptors(
        user.id, // Use user ID or email as label
        [new Float32Array(user.faceDescriptor!)]
      ));

    if (labeledFaceDescriptors.length === 0) {
        toast({ title: "Login Failed", description: "No registered users have face descriptors for comparison. Please re-register or contact admin.", variant: "destructive" });
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
        // Toast for successful login is handled by the form
        return true;
      } else {
         toast({ title: "Login Error", description: "Matched user not found in system.", variant: "destructive" });
      }
    } else {
      toast({ title: "Login Failed", description: "Face not recognized. Please ensure you are a registered user and try again.", variant: "destructive" });
    }

    setLoading(false);
    return false;
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

