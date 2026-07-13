import AccessForm from "@/components/AccessForm";
import BrokenHeart from "@/components/BrokenHeart";

export const metadata = { title: "Admin" };

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 flex justify-center">
            <BrokenHeart size={40} />
          </div>
          <h1 className="display text-3xl font-bold tracking-wider text-gold">CONTROL ROOM</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Admin sign-in by magic link. Allowlisted emails only.
          </p>
        </div>
        <AccessForm admin />
      </div>
    </div>
  );
}
