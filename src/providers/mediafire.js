const jsdom = require('jsdom')
const axios = require('axios')
const { JSDOM } = jsdom

class MediaFireProvider {
  constructor() {
    this.name = 'MediaFire'
    this.supportedDomains = ['mediafire.com']
    
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0'
    ]
    
    this.defaultHeaders = {
      'User-Agent': this.userAgents[0],
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    }
  }

  normalizeUrl(url) {
    let normalizedUrl = url
    
    if (normalizedUrl.endsWith('/file')) {
      normalizedUrl = normalizedUrl.slice(0, -5)
    }
    
    return normalizedUrl
  }

  getHeaders(userAgentIndex = 0) {
    return {
      ...this.defaultHeaders,
      'User-Agent': this.userAgents[userAgentIndex % this.userAgents.length]
    }
  }

  async checkLinkResponseType(url, axiosOptions = {}) {
    try {
      const { headers } = await axios({
        method: 'head',
        url,
        headers: { ...this.getHeaders(), ...axiosOptions.headers },
        timeout: 30000,
        maxRedirects: 5,
        ...axiosOptions,
      })

      if (!headers?.['content-type']?.includes('text/html')) {
        return headers['content-type']
      }

      return false
    } catch (error) {
      throw new Error(`Failed to check response type: ${error.message}`)
    }
  }

  async getDirectLink(url, axiosOptions = {}) {
    const normalizedUrl = this.normalizeUrl(url)
    const validLink = /^(http|https):\/\/(?:www\.)?mediafire\.com\/file\/[0-9a-z]+\/[^\/]+$/i

    if (!validLink.test(normalizedUrl)) {
      throw new Error(`Invalid MediaFire link format: ${normalizedUrl}`)
    }

    let lastError = null

    for (let attempt = 0; attempt < this.userAgents.length; attempt++) {
      try {
        const type = await this.checkLinkResponseType(normalizedUrl, {
          ...axiosOptions,
          headers: { ...this.getHeaders(attempt), ...axiosOptions.headers }
        })

        if (type) {
          return {
            url: normalizedUrl,
            type: type,
            isDirect: true
          }
        }

        const { data } = await axios({
          method: 'get',
          url: normalizedUrl,
          headers: { ...this.getHeaders(attempt), ...axiosOptions.headers },
          timeout: 30000,
          maxRedirects: 5,
          ...axiosOptions,
        })

        const dom = new JSDOM(data)
        const downloadButton = dom.window.document.querySelector('#downloadButton')

        if (!downloadButton) {
          throw new Error('Could not find download button on MediaFire page')
        }

        return {
          url: downloadButton.href,
          type: 'application/octet-stream',
          isDirect: false
        }
      } catch (err) {
        lastError = err
        
        if (err.response) {
          if (err.response.status === 404) {
            throw new Error('The MediaFire link is invalid or the file has been removed')
          }
          
          if (err.response.status === 403) {
            if (attempt < this.userAgents.length - 1) {
              continue
            } else {
              throw new Error('Access denied by MediaFire. The link may be restricted or require authentication.')
            }
          }

          if (attempt < this.userAgents.length - 1) {
            continue
          }
        }
        
        if (attempt < this.userAgents.length - 1) {
          continue
        }
      }
    }

    throw lastError || new Error('All MediaFire attempts failed')
  }

  async validateLink(url) {
    const normalizedUrl = this.normalizeUrl(url)
    const validLink = /^(http|https):\/\/(?:www\.)?mediafire\.com\/file\/[0-9a-z]+\/[^\/]+$/i
    return validLink.test(normalizedUrl)
  }

  async getFileInfo(url, axiosOptions = {}) {
    try {
      const directLink = await this.getDirectLink(url, axiosOptions)
      
      return {
        provider: this.name,
        originalUrl: url,
        directUrl: directLink.url,
        contentType: directLink.type,
        isDirectDownload: directLink.isDirect
      }
    } catch (error) {
      throw new Error(`Failed to get MediaFire file info: ${error.message}`)
    }
  }
}

module.exports = MediaFireProvider 