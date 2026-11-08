"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
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

interface ProfileFormProps {
  defaults: ProfileValues;
}

export function ProfileForm({ defaults }: ProfileFormProps) {
  const [pending, startTransition] = useTransition();

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

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 rounded-xl border border-border bg-card p-6"
      >
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
          <Button type="submit" className="h-9" disabled={pending}>
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
