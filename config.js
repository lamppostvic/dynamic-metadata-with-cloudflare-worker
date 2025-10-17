export const config = {
  domainSource: "https://www.lamppostsocial.com/", // Your WeWeb app preview link
  patterns: [
      {
          pattern: "/eventcopy/[^/]+",
          metaDataEndpoint: "https://yprlpjnmkaptxwvtfidx.supabase.co/functions/v1/event-meta?slug={{ page.slug }}"
      }
      // Add more patterns and their metadata endpoints as needed
  ]
};
