import type { Metadata } from "next";
import Link from "next/link";

import { PostDetailClient } from "@/app/posts/[id]/PostDetailClient";
import { xanoFetch } from "@/app/lib/server/xanoProxy";
import type { PublicPostDetailResponse } from "@/app/lib/publicApiClient";
import { galleryFor } from "@/app/lib/image";

async function loadPost(id: string): Promise<PublicPostDetailResponse | null> {
  try {
    const response = await xanoFetch<PublicPostDetailResponse>("genie/ep_get_post_dev", {
      params: { post_id: id },
    });
    return response.success ? response : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await loadPost(id);

  if (!data) {
    return { title: "Post - Social Bevy" };
  }

  const { post, author } = data;
  const title = `${author?.display_name ?? "Social Bevy"} on Social Bevy`;
  const description = post.post_text?.slice(0, 155) ?? "";
  const image =
    galleryFor(post.image_url, post.image_urls)[0] ||
    "https://socialbevy.com/images/socialbevylogo.png";
  const url = `https://socialbevy.com/posts/${id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Social Bevy",
      type: "website",
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadPost(id);

  if (!data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Post not found</h1>
        <p className="mt-2 text-gray-500">This post may have been removed.</p>
        <Link
          href="/"
          className="mt-6 rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white"
        >
          Discover more on Social Bevy
        </Link>
      </main>
    );
  }

  return <PostDetailClient data={data} postId={id} />;
}
