// This is the full worker code for src/index.ts or src/index.js
// Make sure your config.js is separate and imports into this file

import { config } from './config.js';

export default {
  async fetch(request, env, ctx) {
    const domainSource = config.domainSource;
    const patterns = config.patterns;
    console.log("Worker started");
    const url = new URL(request.url);
    const referer = request.headers.get("Referer");
    
    function getPatternConfig(url2) {
      for (const patternConfig2 of patterns) {
        const regex = new RegExp(patternConfig2.pattern);
        let pathname = url2 + (url2.endsWith("/") ? "" : "/");
        if (regex.test(pathname)) {
          return patternConfig2;
        }
      }
      return null;
    }
    
    function isPageData(url2) {
      const pattern = /\/public\/data\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.json/;
      return pattern.test(url2);
    }
    
    async function requestMetadata(url2, metaDataEndpoint) {
      const trimmedUrl = url2.endsWith("/") ? url2.slice(0, -1) : url2;
      const parts = trimmedUrl.split("/");
      const id = parts[parts.length - 1];
      const placeholderPattern = /{([^}]+)}/;
      const metaDataEndpointWithId = metaDataEndpoint.replace(placeholderPattern, id);
      
      console.log("Fetching metadata from:", metaDataEndpointWithId);
      
      const metaDataResponse = await fetch(metaDataEndpointWithId);
      
      if (!metaDataResponse.ok) {
        console.error("Metadata fetch failed:", metaDataResponse.status, await metaDataResponse.text());
        return null;
      }
      
      const metadata = await metaDataResponse.json();
      console.log("Metadata received:", metadata);
      return metadata;
    }
    
    const patternConfig = getPatternConfig(url.pathname);
    
    if (patternConfig) {
      console.log("Dynamic page detected:", url.pathname);
      let source = await fetch(`${domainSource}${url.pathname}`);
      const sourceHeaders = new Headers(source.headers);
      sourceHeaders.delete("X-Robots-Tag");
      source = new Response(source.body, {
        status: source.status,
        headers: sourceHeaders
      });
      
      const metadata = await requestMetadata(url.pathname, patternConfig.metaDataEndpoint);
      
      if (!metadata) {
        console.error("Failed to fetch metadata, returning original page");
        return source;
      }
      
      console.log("Metadata fetched:", metadata);
      const customHeaderHandler = new CustomHeaderHandler(metadata);
      return new HTMLRewriter().on("*", customHeaderHandler).transform(source);
      
    } else if (isPageData(url.pathname)) {
      console.log("Page data detected:", url.pathname);
      console.log("Referer:", referer);
      
      const sourceResponse2 = await fetch(`${domainSource}${url.pathname}`);
      let sourceData = await sourceResponse2.json();
      let pathname = referer;
      pathname = pathname ? pathname + (pathname.endsWith("/") ? "" : "/") : null;
      
      if (pathname !== null) {
        const patternConfigForPageData = getPatternConfig(pathname);
        if (patternConfigForPageData) {
          const metadata = await requestMetadata(pathname, patternConfigForPageData.metaDataEndpoint);
          
          if (!metadata) {
            console.error("Failed to fetch metadata for page data");
            return new Response(JSON.stringify(sourceData), {
              headers: { "Content-Type": "application/json" }
            });
          }
          
          console.log("Metadata fetched:", metadata);
          sourceData.page = sourceData.page || {};
          sourceData.page.title = sourceData.page.title || {};
          sourceData.page.meta = sourceData.page.meta || {};
          sourceData.page.meta.desc = sourceData.page.meta.desc || {};
          sourceData.page.meta.keywords = sourceData.page.meta.keywords || {};
          sourceData.page.socialTitle = sourceData.page.socialTitle || {};
          sourceData.page.socialDesc = sourceData.page.socialDesc || {};
          
          if (metadata.title) {
            sourceData.page.title.en = metadata.title;
            sourceData.page.socialTitle.en = metadata.title;
          }
          if (metadata.description) {
            sourceData.page.meta.desc.en = metadata.description;
            sourceData.page.socialDesc.en = metadata.description;
          }
          if (metadata.image) {
            sourceData.page.metaImage = metadata.image;
          }
          if (metadata.keywords) {
            sourceData.page.meta.keywords.en = metadata.keywords;
          }
          
          console.log("returning file: ", JSON.stringify(sourceData));
          return new Response(JSON.stringify(sourceData), {
            headers: { "Content-Type": "application/json" }
          });
        }
      }
    }
    
    console.log("Fetching original content for:", url.pathname);
    const sourceUrl = new URL(`${domainSource}${url.pathname}`);
    const sourceRequest = new Request(sourceUrl, request);
    const sourceResponse = await fetch(sourceRequest);
    const modifiedHeaders = new Headers(sourceResponse.headers);
    modifiedHeaders.delete("X-Robots-Tag");
    
    return new Response(sourceResponse.body, {
      status: sourceResponse.status,
      headers: modifiedHeaders
    });
  }
};

class CustomHeaderHandler {
  constructor(metadata) {
    this.metadata = metadata;
  }
  
  element(element) {
    if (element.tagName == "title") {
      console.log("Replacing title tag content");
      element.setInnerContent(this.metadata.title);
    }
    if (element.tagName == "meta") {
      const name = element.getAttribute("name");
      switch (name) {
        case "title":
          element.setAttribute("content", this.metadata.title);
          break;
        case "description":
          element.setAttribute("content", this.metadata.description);
          break;
        case "image":
          element.setAttribute("content", this.metadata.image);
          break;
        case "keywords":
          if (this.metadata.keywords) {
            element.setAttribute("content", this.metadata.keywords);
          }
          break;
        case "twitter:title":
          element.setAttribute("content", this.metadata.title);
          break;
        case "twitter:description":
          element.setAttribute("content", this.metadata.description);
          break;
        case "twitter:image":
          element.setAttribute("content", this.metadata.image);
          break;
      }
      const itemprop = element.getAttribute("itemprop");
      switch (itemprop) {
        case "name":
          element.setAttribute("content", this.metadata.title);
          break;
        case "description":
          element.setAttribute("content", this.metadata.description);
          break;
        case "image":
          element.setAttribute("content", this.metadata.image);
          break;
      }
      const type = element.getAttribute("property");
      switch (type) {
        case "og:title":
          console.log("Replacing og:title");
          element.setAttribute("content", this.metadata.title);
          break;
        case "og:description":
          console.log("Replacing og:description");
          element.setAttribute("content", this.metadata.description);
          break;
        case "og:image":
          console.log("Replacing og:image");
          element.setAttribute("content", this.metadata.image);
          break;
      }
      const robots = element.getAttribute("name");
      if (robots === "robots" && element.getAttribute("content") === "noindex") {
        console.log("Removing noindex tag");
        element.remove();
      }
    }
  }
}
