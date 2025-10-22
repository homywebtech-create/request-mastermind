# Notification Deep Link Routes

This document maps all notification types to their respective routes in the app.

## Notification Types and Routes

| Notification Type | Route | Page | Description |
|------------------|-------|------|-------------|
| `new_order` | `/specialist-orders/new` | New Orders | New job offer for specialist |
| `resend_order` | `/specialist-orders/new` | New Orders | Re-sent job offer |
| `new_quote` | `/specialist-orders` | Active Orders | New quote from company |
| `quote_response` | `/specialist-orders` | Active Orders | Response to specialist's quote |
| `order_update` | `/order-tracking/:orderId` | Order Tracking | Order status changed |
| `order_status_change` | `/order-tracking/:orderId` | Order Tracking | Order status update |
| `booking_confirmed` | `/order-tracking/:orderId` | Order Tracking | Booking confirmed |
| `booking_update` | `/order-tracking/:orderId` | Order Tracking | Booking details changed |
| `order_expired` | `/specialist-orders/new` | New Orders | Order 3-minute timer expired |
| `test` | `/specialist-orders/new` | New Orders | Test notification |

## How It Works

### 1. Notification Sent
When creating an order or updating status, the system calls:
```typescript
await supabase.functions.invoke('send-push-notification', {
  body: {
    specialistIds: [...],
    title: 'Notification Title',
    body: 'Notification message',
    data: {
      orderId: 'uuid',
      type: 'new_order', // or other type
      // ... other data
    }
  }
});
```

### 2. Edge Function Processing
The `send-push-notification` edge function:
- Receives notification data
- Determines target route based on `data.type`
- Includes route in FCM payload

### 3. Android Native Handler
`MyFirebaseMessagingService.java`:
- Receives FCM message when app is in background/killed
- Extracts route from message data
- Creates deep link: `request-mastermind://open?route={route}`
- Shows notification with deep link intent

### 4. App Deep Link Handler
`src/App.tsx` - `DeepLinkHandler`:
- Listens for app URL opens (from notification tap)
- Extracts route from URL parameters
- If user logged in → Navigate directly to route
- If user not logged in → Save route to preferences → Navigate to login

### 5. Post-Login Navigation
`src/pages/SpecialistAuth.tsx`:
- After successful login, checks for pending route
- If found, navigates to that route
- Otherwise, navigates to default `/specialist-orders`

## Routes Configured in App

All routes are properly configured in `src/App.tsx` for the mobile app:
- ✅ `/specialist-auth` - Login page
- ✅ `/specialist-orders` - Active orders/home
- ✅ `/specialist-orders/new` - New orders
- ✅ `/specialist-orders/stats` - Statistics
- ✅ `/specialist-orders/profile` - Profile
- ✅ `/order-tracking/:orderId` - Order tracking with dynamic ID
- ✅ `/specialist/new-orders` - Legacy alias for new orders

## Testing Notifications

To test each notification type:

1. **New Order**: Create order from admin → sends to specialists
2. **Resend Order**: Click resend button in orders table
3. **Order Expired**: Wait 3 minutes after order is sent → automated notification sent
4. **Test**: Use notification test page (`/push-test`)
5. **Order Updates**: Change order status in tracking page

## Automated Notifications

### Order Expiry Notifications
- **Trigger**: Automatically sent when order 3-minute timer expires
- **Frequency**: Checked every minute by cron job
- **Recipients**: All specialists who received the order but didn't submit a quote
- **Message**: "⏰ انتهى وقت العرض - انتهى وقت تقديم عرض للطلب {order_number}"
- **Route**: Takes user to new orders page to see other opportunities
- **Implementation**: 
  - Edge function: `supabase/functions/notify-expired-orders/index.ts`
  - Cron job: Runs every minute via pg_cron
  - Database field: `orders.notified_expiry` tracks if notification was sent

## Common Issues

### Issue: Notification doesn't navigate
**Solution**: Check that:
1. Notification includes `data.type` field
2. The type is listed in edge function route mapping
3. The target route exists in App.tsx
4. User has necessary authentication

### Issue: App opens but stays on login
**Solution**: 
- Route was saved to preferences but user needs to log in first
- After login, app will auto-navigate to saved route

## Code Locations

- **Send notifications**: 
  - `src/pages/Dashboard.tsx` (new orders)
  - `src/pages/Orders.tsx` (new orders)
  - `src/components/orders/orders-table.tsx` (resend orders)
  
- **Edge function**: `supabase/functions/send-push-notification/index.ts`
- **Android handler**: `android/app/src/main/java/.../MyFirebaseMessagingService.java`
- **Deep link handler**: `src/App.tsx` (DeepLinkHandler component)
- **Post-login navigation**: `src/pages/SpecialistAuth.tsx`
