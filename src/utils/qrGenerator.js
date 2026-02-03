const QRCode = require('qrcode');

class QRGenerator {
  
  // Generate QR code image from data
  async generateQRCodeImage(data, options = {}) {
    try {
      const defaultOptions = {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 300,
        ...options
      };

      const qrCodeDataURL = await QRCode.toDataURL(data, defaultOptions);
      
      return {
        success: true,
        data_url: qrCodeDataURL,
        data: data,
        size: defaultOptions.width
      };
    } catch (error) {
      console.error('QR code generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Generate QR code for product
  async generateProductQRCode(product) {
    const qrData = {
      type: 'product',
      product_id: product.id,
      sku: product.sku,
      qr_code: product.qr_code_data,
      url: product.qr_code_url
    };

    return await this.generateQRCodeImage(JSON.stringify(qrData));
  }

  // Generate QR code for URL
  async generateURLQRCode(url) {
    return await this.generateQRCodeImage(url, {
      width: 400
    });
  }

  // Generate QR codes in bulk
  async generateBulkQRCodes(dataArray, options = {}) {
    const results = [];
    
    for (const data of dataArray) {
      try {
        const qrCode = await this.generateQRCodeImage(data, options);
        results.push({
          data: data,
          success: true,
          qr_code: qrCode.data_url
        });
      } catch (error) {
        results.push({
          data: data,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }
}

module.exports = new QRGenerator();