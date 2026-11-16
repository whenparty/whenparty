export default {
  layout: "post.njk",
  tags: "posts",
  titleSuffix: "Blog",
  permalink: data => `/${data.page.fileSlug}/`,
};
