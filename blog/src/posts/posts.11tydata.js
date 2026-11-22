export default {
  layout: 'post.njk',
  tags: 'posts',
  titleSuffix: 'Blog',
  ogType: 'article',
  permalink: data => `/${data.page.fileSlug}/`
}
