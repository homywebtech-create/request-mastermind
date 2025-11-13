# WhatsApp Carousel - Meta Catalog Setup Guide

This guide explains how to set up Meta Business Manager Catalog for WhatsApp Multi-Product Messages (Carousel).

## Prerequisites

1. Meta Business Manager account
2. WhatsApp Business API access
3. Connected catalog to your WhatsApp Business Account

## Step 1: Create a Catalog in Meta Business Manager

1. Go to [Meta Business Manager](https://business.facebook.com/)
2. Navigate to **Commerce Manager** > **Catalogs**
3. Click **Create Catalog**
4. Select **E-commerce** as catalog type
5. Name your catalog (e.g., "Professional Services Catalog")
6. Click **Create**

## Step 2: Add Products (Professionals) to Catalog

Each professional should be added as a product in the catalog. You can do this via:

### Option A: Manual Upload (for testing)
1. In your catalog, click **Add Items**
2. Click **Manually add product info**
3. Fill in product details:
   - **Product ID**: `specialist_{specialist_id}` (e.g., `specialist_123`)
   - **Title**: Professional's name
   - **Description**: Company name + Service details
   - **Price**: Quoted price
   - **Image URL**: Professional's photo URL
   - **Availability**: In stock
4. Click **Add**

### Option B: Bulk Upload via CSV
Create a CSV file with the following format:

```csv
id,title,description,availability,condition,price,link,image_link
specialist_123,John Doe,ABC Company - Plumbing Services,in stock,new,50 SAR,https://yourapp.com/book/specialist_123,https://yourapp.com/images/specialist_123.jpg
specialist_456,Jane Smith,XYZ Company - Electrical Services,in stock,new,60 SAR,https://yourapp.com/book/specialist_456,https://yourapp.com/images/specialist_456.jpg
```

Upload this CSV:
1. In your catalog, click **Add Items** > **Use Data Sources**
2. Click **Upload Product Info**
3. Select your CSV file
4. Map the columns
5. Click **Upload**

### Option C: API Upload (Recommended for Dynamic Updates)
Use the Meta Graph API to programmatically add/update products:

```typescript
// Example API call to add a product
const response = await fetch(
  `https://graph.facebook.com/v21.0/${CATALOG_ID}/products`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      retailer_id: `specialist_${specialistId}`,
      name: specialistName,
      description: `${companyName} - ${serviceType}`,
      price: quotedPrice * 100, // Price in smallest currency unit (halalas)
      currency: 'SAR',
      availability: 'in stock',
      condition: 'new',
      image_url: specialistImageUrl,
      url: `https://yourapp.com/book/specialist/${specialistId}`
    })
  }
);
```

## Step 3: Connect Catalog to WhatsApp Business Account

1. In Meta Business Manager, go to **WhatsApp Manager**
2. Select your WhatsApp Business Account
3. Go to **Settings** > **Commerce**
4. Click **Connect Catalog**
5. Select your catalog
6. Click **Connect**

## Step 4: Get Your Catalog ID

1. In Commerce Manager, open your catalog
2. Copy the Catalog ID from the URL or settings
3. It will look like: `1234567890123456`

## Step 5: Add Catalog ID to Lovable Secrets

You need to add the `META_CATALOG_ID` secret to your Lovable project:

1. In Lovable, I will prepare the secret form for you
2. Enter your Catalog ID when prompted
3. The edge function will automatically use this ID

## Step 6: Product Synchronization Strategy

To keep products (professionals) synchronized with your database:

### Real-time Sync (Recommended)
Create a database trigger or edge function that:
- Adds a product to the catalog when a new professional is created
- Updates the product when professional details change
- Removes the product when a professional is deactivated

### Batch Sync
Create a scheduled edge function that:
- Runs every hour/day
- Fetches all active professionals from database
- Updates the entire catalog via API

## Testing the Carousel

1. Ensure at least 2-3 products are in your catalog
2. Make sure products have:
   - Valid `retailer_id` matching `specialist_{id}` format
   - Product images
   - Prices in SAR
   - Availability set to "in stock"
3. Test by triggering the carousel send function

## Troubleshooting

### Error: "Catalog not found"
- Verify the catalog ID is correct
- Check that the catalog is connected to your WhatsApp Business Account

### Error: "Product not found"
- Ensure the `product_retailer_id` matches the `id` field in your catalog
- Check that products have `availability: "in stock"`

### Images not showing
- Verify image URLs are publicly accessible
- Use HTTPS URLs only
- Recommended image size: 1200x1200px
- Supported formats: JPG, PNG

### Carousel not displaying
- WhatsApp requires at least 2 products for carousel
- Maximum 10 products per carousel
- Ensure all products have required fields (id, title, price, image)

## API Rate Limits

- Meta Graph API: 200 calls per hour per user
- WhatsApp Business API: 1000 messages per day (varies by tier)

## Best Practices

1. **Product IDs**: Use consistent format like `specialist_{uuid}`
2. **Images**: Host on CDN for fast loading
3. **Prices**: Always include currency and use consistent format
4. **Descriptions**: Keep concise (max 200 characters)
5. **URLs**: Use deep links to your booking page with pre-filled specialist info
6. **Sync**: Update catalog in real-time when professional details change

## Additional Resources

- [Meta Commerce Manager Documentation](https://www.facebook.com/business/help/1659534074121655)
- [WhatsApp Business API - Product Messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-product-messages)
- [Meta Graph API - Catalog Management](https://developers.facebook.com/docs/marketing-api/catalog)
