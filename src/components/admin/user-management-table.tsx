
"use client";

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import type { User } from '@/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import FaceCapture from '@/components/face/face-capture';
import { useToast } from '@/hooks/use-toast';
import { Edit3, Loader2 } from 'lucide-react';
import Image from 'next/image';


export default function UserManagementTable() {
  const { users, updateUserFaceAdmin, loading: authLoading } = useAuth();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newFaceUri, setNewFaceUri] = useState<string | null>(null);
  const [newFaceDescriptor, setNewFaceDescriptor] = useState<number[] | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleOpenUpdateDialog = (user: User) => {
    setSelectedUser(user);
    setNewFaceUri(null); 
    setNewFaceDescriptor(null);
    setIsDialogOpen(true);
  };

  const handleFaceCapturedInDialog = (dataUrl: string, descriptor: number[] | null) => {
    setNewFaceUri(dataUrl);
    setNewFaceDescriptor(descriptor);
     if (descriptor) {
      toast({ title: "New Face Processed", description: "New face image and descriptor ready for update." });
    } else {
      toast({ title: "Face Captured (No Descriptor)", description: "New face image captured, but descriptor could not be computed. Try again for reliable recognition.", variant: "default", duration: 7000 });
    }
  };

  const handleUpdateUserFace = async () => {
    if (!selectedUser || !newFaceUri) {
        toast({title: "Missing Data", description: "No new face image captured.", variant: "destructive"});
        return;
    }
    if (!newFaceDescriptor) {
        toast({title: "Missing Descriptor", description: "Facial descriptor for the new image is missing. Please recapture clearly.", variant: "destructive"});
        return;
    }


    setIsUpdating(true);
    try {
      const success = await updateUserFaceAdmin(selectedUser.id, newFaceUri, newFaceDescriptor);
      if (success) {
        toast({ title: "Face Updated", description: `${selectedUser.name}'s login face and descriptor have been updated.` });
        setIsDialogOpen(false); 
      } else {
        // Error toasts are handled by updateUserFaceAdmin in auth context
      }
    } catch (error) {
      console.error("Error updating face:", error);
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };
  
  const getInitials = (name: string = "") => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase() || 'U';
  };

  if (authLoading) return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!users || users.length === 0) return <p className="text-center text-muted-foreground p-8">No users found.</p>;

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-headline font-bold mb-6 text-primary">User Management</h1>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Avatar</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Descriptor</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.enhancedFaceImageUri} alt={user.name} data-ai-hint="profile face"/>
                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.isAdmin ? 'Admin' : 'User'}</TableCell>
                <TableCell>{user.faceDescriptor ? 'Yes' : 'No'}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => handleOpenUpdateDialog(user)}>
                    <Edit3 className="mr-2 h-4 w-4" /> Update Face
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {selectedUser && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Update Face for {selectedUser.name}</DialogTitle>
              <DialogDescription>
                Capture a new face image. This will replace the existing login face and recompute the descriptor.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="flex flex-col items-center">
                <p className="text-sm font-medium mb-1">Current Enhanced Face:</p>
                <div className="w-32 h-32 rounded-md overflow-hidden border bg-muted mb-4">
                  {selectedUser.enhancedFaceImageUri ? (
                    <Image src={selectedUser.enhancedFaceImageUri} alt="Current face" width={128} height={128} className="object-cover w-full h-full" data-ai-hint="person face" />
                  ) : <div className="w-full h-full flex items-center justify-center text-muted-foreground">No Image</div>}
                </div>
                <FaceCapture onFaceCaptured={handleFaceCapturedInDialog} imageSize={200} captureButtonText="Capture New Face" />
                {newFaceUri && newFaceDescriptor && <p className="text-xs text-green-600 mt-2">New face & descriptor captured. Ready for update.</p>}
                {newFaceUri && !newFaceDescriptor && <p className="text-xs text-amber-600 mt-2">New face captured, descriptor failed. Try retaking.</p>}
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="button" onClick={handleUpdateUserFace} disabled={isUpdating || !newFaceUri || !newFaceDescriptor}>
                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isUpdating ? 'Updating...' : 'Save New Face'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Minimal Card component for structure
const Card: React.FC<{children: React.ReactNode, className?:string}> = ({children, className}) => (
  <div className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}>
    {children}
  </div>
);

// Minimal cn utility if not globally available
const cn = (...inputs: any[]) => inputs.filter(Boolean).join(' ');
