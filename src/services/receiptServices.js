import { jsPDF } from 'jspdf';
import logo from '/src/assets/logo.png';
import { getBusinessInfo } from './mockDatabase';

// Default business info in case API fails
const DEFAULT_BUSINESS_INFO = {
  tin: "908-767-876-000",
  name: "GoodLand Cafe",
  status: "VAT_Reg",
  address: "Cariño Street, Baguio City",
  phone: "(239) 555-0298",
  logoUrl: logo,
};

// Helper function to convert image URL to base64
const getBase64ImageFromURL = async (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL('image/png');
      resolve(dataURL);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
};

export const generateReceiptPDF = async (transaction, businessInfo) => {
  try {
    // Ensure businessInfo is valid, use defaults if necessary
    const info = businessInfo && typeof businessInfo === 'object' ? businessInfo : {};
    
    // Merge with defaults to fill in any missing fields
    const finalInfo = {
      tin: info.tin || DEFAULT_BUSINESS_INFO.tin,
      name: info.name || DEFAULT_BUSINESS_INFO.name,
      status: info.status || DEFAULT_BUSINESS_INFO.status,
      address: info.address || DEFAULT_BUSINESS_INFO.address,
      phone: info.phone || DEFAULT_BUSINESS_INFO.phone,
      logoUrl: info.logoUrl || DEFAULT_BUSINESS_INFO.logoUrl,
    };

    // Dimensions in inches (5.5" x 8.5" Half Letter)
    const width = 5.5;
    const height = 10;
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'in',
      format: [width, height]
    });

    // Fonts - Using Courier for that authentic receipt look as per asterisks in template
    doc.setFont('courier', 'normal'); 

    const centerX = width / 2;
    const marginX = 0.3;
    let currentY = 0.5;

    // Helper for centering text
    const centerText = (text, y, fontSize = 10, fontStyle = 'normal') => {
      doc.setFontSize(fontSize);
      doc.setFont('courier', fontStyle);
      // Ensure text and y are valid parameters
      if (typeof text !== 'string' || typeof y !== 'number') {
        console.error('Invalid arguments to centerText:', { text, y, fontSize, fontStyle });
        return;
      }
      doc.text(text, centerX, y, { align: 'center' });
    };

    // 1. Logo
    // If logoUrl is present, try to load and display it. Otherwise fallback to text.
    if (finalInfo.logoUrl) {
      try {
          const imgData = await getBase64ImageFromURL(finalInfo.logoUrl);
          const imgProps = doc.getImageProperties(imgData);
          
          // Define max width for logo (e.g., 1.2 inches)
          const logoWidth = 1.2;
          // Calculate height to maintain aspect ratio
          const logoHeight = (imgProps.height * logoWidth) / imgProps.width;
          
          // Center the image: (PageWidth - ImageWidth) / 2
          const x = (width - logoWidth) / 2;
          
          doc.addImage(imgData, 'PNG', x, currentY, logoWidth, logoHeight);
          currentY += logoHeight + 0.2; // Add height + padding
      } catch (e) {
          console.warn("Could not load logo image, falling back to text.", e);
          centerText("[Business Logo]", currentY, 14, 'bold');
          currentY += 0.3;
      }
    } else {
        centerText("[Business Logo]", currentY, 14, 'bold');
        currentY += 0.3;
    }

    // 2. Business Info
    // {Business Name}
    centerText(finalInfo.name || '[Business Name]', currentY, 12, 'bold');
    currentY += 0.2;

    // {B_Status} TIN:{TIN Number}
    const status = finalInfo.status || 'Registered';
    const tin = finalInfo.tin || 'N/A';
    centerText(`${status} TIN:${tin}`, currentY, 10);
    currentY += 0.2;

    // {Address}
    centerText(finalInfo.address || '[Address]', currentY, 10);
    currentY += 0.2;

    // (Phone)
    centerText(finalInfo.phone || '[Phone]', currentY, 10);
    currentY += 0.2;

    // {Date}
    centerText(new Date().toLocaleDateString(), currentY, 10);
    currentY += 0.3;

    // 3. Separator
    centerText("***********************************", currentY, 10);
    currentY += 0.2;

    // 4. Metadata
    // Receipt No.:       Time:
    doc.setFontSize(10);
    doc.setFont('courier', 'normal');
    
    // Left side: Receipt No
    doc.text("Receipt No.:", marginX, currentY);
    doc.text(String(transaction.orderNumber).padStart(4, '0'), marginX + 1.2, currentY); 
    
    // Right side: Time
    const timeLabel = "Time: ";
    const timeValue = transaction.timeOrdered;
    // Calculate positions roughly or align right
    doc.text(timeValue, width - marginX, currentY, { align: 'right' });
    // Position label to the left of the time value. 
    // Courier is monospaced, but align:right is safer for the value. 
    // We'll just place the label at a fixed position for simplicity or calculate width.
    // Using a fixed offset from right for the label to align with the template visual.
    doc.text(timeLabel, width - marginX - 1.5, currentY); 
    
    currentY += 0.3;

    // Order Type
    doc.text("Order Type:", marginX, currentY);
    doc.text(transaction.type || 'Dine In', marginX + 1.2, currentY);
    currentY += 0.3;

    // 5. Items Header
    // Item Name      Qty      Price      Total
    doc.setFont('courier', 'bold');
    doc.text("Item Name", marginX, currentY);
    doc.text("Qty", width / 2 - 0.3, currentY, { align: 'center' });
    doc.text("Price", width / 2 + 0.3, currentY, { align: 'center' });
    doc.text("Total", width - marginX, currentY, { align: 'right' });
    currentY += 0.2;

    // 6. Items List
    doc.setFont('courier', 'normal');
    transaction.items.forEach(item => {
      // Truncate long names
      const name = item.menuItem.name.length > 20 ? item.menuItem.name.substring(0, 18) + '...' : item.menuItem.name;
      const price = item.menuItem.totalPrice.toFixed(2);
      const itemTotal = (item.menuItem.totalPrice * item.quantity).toFixed(2);
      
      doc.text(name, marginX, currentY);
      doc.text(String(item.quantity), width / 2 - 0.3, currentY, { align: 'center' });
      doc.text(price, width / 2 + 0.3, currentY, { align: 'center' });
      doc.text(itemTotal, width - marginX, currentY, { align: 'right' });
      currentY += 0.2;
    });

    currentY += 0.8;

    // 7. Summary Section
    centerText("-----------------------------------", currentY, 10);
    currentY += 0.3;
    
    // Subtotal
    doc.setFont('courier', 'normal');
    doc.setFontSize(10);
    const rightAlignX = width - marginX;
    const labelAlignX = width / 2 + 0.5; // Start labels past center
    
    doc.text("Subtotal", labelAlignX, currentY, { align: 'right' });
    doc.text(transaction.baseAmount.toFixed(2), rightAlignX, currentY, { align: 'right' });
    currentY += 0.2;

    // Discount (if any)
    if (transaction.discountAmount > 0) {
      doc.text(`Discount (${transaction.discountType || 'PWD/Senior'})`, labelAlignX, currentY, { align: 'right' });
      doc.text("-" + transaction.discountAmount.toFixed(2), rightAlignX, currentY, { align: 'right' });
      currentY += 0.2;
    }

    // Service Charge
    doc.text(`Service Charge (${transaction.type === 'Dine In' ? 'Dine In' : 'Takeout'})`, labelAlignX, currentY, { align: 'right' });
    doc.text(transaction.serviceFee.toFixed(2), rightAlignX, currentY, { align: 'right' });
    currentY += 0.2;

    // VAT Amount
    doc.text("VAT Amount (12%)", labelAlignX, currentY, { align: 'right' });
    doc.text(transaction.vatPortion.toFixed(2), rightAlignX, currentY, { align: 'right' });
    currentY += 0.3;

    // Grand Total
    centerText("-----------------------------------", currentY, 10);
    currentY += 0.2;
    doc.setFont('courier', 'bold');
    doc.setFontSize(12);
    doc.text("Grand Total", labelAlignX, currentY, { align: 'right' });
    doc.text(transaction.totalAmount.toFixed(2), rightAlignX, currentY, { align: 'right' });
    currentY += 0.3;
    centerText("-----------------------------------", currentY, 10);
    currentY += 0.3;

    // 8. Payment Section
    doc.setFont('courier', 'normal');
    doc.setFontSize(10);
    doc.text("Cash Received", labelAlignX, currentY, { align: 'right' });
    doc.text(transaction.cashProvided !== undefined ? transaction.cashProvided.toFixed(2) : "0.00", rightAlignX, currentY, { align: 'right' });
    currentY += 0.2;

    // Change
    doc.setFont('courier', 'bold');
    doc.text("Change", labelAlignX, currentY, { align: 'right' });
    doc.text(transaction.change !== undefined ? transaction.change.toFixed(2) : "0.00", rightAlignX, currentY, { align: 'right' });
    currentY += 0.4;

    // 9. Footer Separator
    doc.setFont('courier', 'normal');
    doc.setFontSize(10);
    centerText("***********************************", currentY, 10);
    currentY += 0.4;

    // 10. Footer Messages
    centerText("Thank you for your visit!", currentY, 10);
    currentY += 0.2;
    centerText("Please come again", currentY, 10);
    currentY += 0.3;
    
    // Additional business info
    centerText("This serves as official receipt", currentY, 8);
    currentY += 0.3;
    
    // 11. Separator Line
    centerText("***********************************", currentY, 10);
    currentY += 0.4;
    
    // 12. System info
    doc.setFontSize(8);
    centerText("POS System v1.0", currentY, 8);
    currentY += 0.15;
    centerText("Generated on " + new Date().toLocaleString(), currentY, 8);
    
    // Save - Naming it to simulate being in an assets folder
    const filename = `assets/receipts/Receipt-${String(transaction.orderNumber).padStart(4, '0')}-${new Date().getTime()}.pdf`;
    doc.save(filename);
    
    return true;
  } catch (error) {
    console.error('Error in generateReceiptPDF:', error);
    throw error;
  }
};