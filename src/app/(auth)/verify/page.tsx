import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function VerifyPage() {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            We sent you a verification link. Click the link in your email to
            activate your account, then return here to sign in.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
