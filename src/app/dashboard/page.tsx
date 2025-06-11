"use client";
import ProtectedPage from '@/components/auth/protected-page';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null; // Should be handled by ProtectedPage

  const getInitials = (name: string = "") => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase() || 'U';
  };

  return (
    <ProtectedPage>
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <Card className="max-w-2xl mx-auto shadow-lg">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Avatar className="h-24 w-24 border-4 border-primary">
                <AvatarImage src={user.enhancedFaceImageUri} alt={user.name} data-ai-hint="profile face" />
                <AvatarFallback className="text-3xl">{getInitials(user.name)}</AvatarFallback>
              </Avatar>
            </div>
            <CardTitle className="text-3xl font-headline">Welcome, {user.name}!</CardTitle>
            <CardDescription className="text-lg">This is your FaceLog dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              You have successfully logged in using face recognition.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <div>
                <h3 className="font-semibold mb-2 text-center">Original Captured Face</h3>
                <div className="aspect-square w-full max-w-[200px] mx-auto rounded-md overflow-hidden border bg-muted">
                  {user.faceImageUri ? (
                    <Image src={user.faceImageUri} alt="Original face" width={200} height={200} className="object-cover w-full h-full" data-ai-hint="person face"/>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">No image</div>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-center">Enhanced Face for Login</h3>
                 <div className="aspect-square w-full max-w-[200px] mx-auto rounded-md overflow-hidden border bg-muted">
                  {user.enhancedFaceImageUri ? (
                     <Image src={user.enhancedFaceImageUri} alt="Enhanced face" width={200} height={200} className="object-cover w-full h-full" data-ai-hint="profile face" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">No image</div>
                  )}
                </div>
              </div>
            </div>
             {user.isAdmin && (
                <p className="text-center text-accent pt-4">You have admin privileges.</p>
              )}
          </CardContent>
        </Card>
      </div>
    </ProtectedPage>
  );
}
