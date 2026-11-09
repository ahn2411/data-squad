"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { profileSchema, type ProfileValues } from "@/features/profile/schemas";
import { updateProfileAction } from "@/features/profile/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ProfileFormProps {
  defaults: ProfileValues;
  teamId: string;
  userId: string;
  avatarPreviewUrl: string | null;
}

export function ProfileForm({ defaults, teamId, userId, avatarPreviewUrl }: ProfileFormProps) {
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: defaults,
  });

  const onSubmit = (values: ProfileValues) => {
    startTransition(async () => {
      const res = await updateProfileAction(values);
      if (res.ok) toast.success("Profile saved.");
      else if (!res.ok) toast.error(res.error);
    });
  };

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Profile images must be 5 MB or smaller.");
      return;
    }

    const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
    const path = `${teamId}/${userId}/avatar.${extension}`;
    setUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.storage
        .from("squad-avatars")
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
      if (error) {
        toast.error("Could not upload the image. Check that the latest Storage migration is installed.");
        return;
      }
      form.setValue("avatarPath", path, { shouldDirty: true, shouldValidate: true });
      setPreview(URL.createObjectURL(file));
      toast.success("Image uploaded. Save your profile to apply it.");
    } catch {
      toast.error("Could not upload the image.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 rounded-xl border border-border bg-card p-6"
      >
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            {preview ? <AvatarImage src={preview} alt="Selected profile image" /> : null}
            {!preview && avatarPreviewUrl ? <AvatarImage src={avatarPreviewUrl} alt="Profile image" /> : null}
            <AvatarFallback>{defaults.fullName.slice(0, 1).toUpperCase() || "M"}</AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
              Upload profile image
              <input
                type="file"
                className="sr-only"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading || pending}
                onChange={(event) => {
                  void uploadAvatar(event.currentTarget.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <p className="text-xs text-muted-foreground">JPG, PNG, or WebP. Maximum 5 MB.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[13px]">Full name</FormLabel>
                <FormControl>
                  <Input className="h-9" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[13px]">Username</FormLabel>
                <FormControl>
                  <Input className="h-9" placeholder="optional" {...field} />
                </FormControl>
                <FormDescription className="text-[12px]">
                  Letters, numbers, underscores, hyphens.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="capstoneRepositoryUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[13px]">Capstone repository</FormLabel>
              <FormControl>
                <Input
                  className="h-9"
                  placeholder="https://github.com/you/your-capstone"
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-[12px]">
                Share the GitHub repository for your final project with active squad members.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[13px]">Bio</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  className="resize-none"
                  placeholder="A short note about your focus this season."
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-[12px]">
                {field.value?.length ?? 0}/280
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="githubUsername"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[13px]">GitHub username</FormLabel>
                <FormControl>
                  <Input className="h-9" placeholder="optional" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="githubProfileUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[13px]">GitHub profile URL</FormLabel>
                <FormControl>
                  <Input
                    className="h-9"
                    placeholder="https://github.com/username"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="timezone"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[13px]">Timezone</FormLabel>
              <FormControl>
                <Input className="h-9 max-w-xs" {...field} />
              </FormControl>
              <FormDescription className="text-[12px]">
                Used to display deadlines in your local time.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button type="submit" className="h-9" disabled={pending || uploading}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
