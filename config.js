export const config = {
  domainSource: "https://www.lamppostsocial.com/", // Your WeWeb app preview link
  patterns: [
      {
          pattern: "/eventpage/[^/]+",
          metaDataEndpoint: "https://yprlpjnmkaptxwvtfidx.supabase.co/functions/v1/event-meta?slug={id}"  // Remove {{ page.slug }}, use {id}
      }
      // Add more patterns and their metadata endpoints as needed
  ]
};
