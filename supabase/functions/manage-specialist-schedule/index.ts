import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScheduleRequest {
  specialist_id: string;
  order_id: string;
  start_time?: string;
  hours_count: number;
  booking_date: string;
  booking_time: string;
  check_only?: boolean; // If true, only check availability without creating schedule
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const { specialist_id, order_id, start_time, hours_count, booking_date, booking_time, check_only } = await req.json() as ScheduleRequest;

    if (!specialist_id || !order_id || !booking_date || !booking_time || !hours_count) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse booking date and time
    const [hours, minutes] = booking_time.split(':').map(Number);
    const startDateTime = new Date(booking_date);
    startDateTime.setHours(hours, minutes, 0, 0);

    // Calculate end time
    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(endDateTime.getHours() + hours_count);

    // Check if specialist is available
    const { data: isAvailable, error: checkError } = await supabaseClient
      .rpc('is_specialist_available', {
        _specialist_id: specialist_id,
        _start_time: startDateTime.toISOString(),
        _end_time: endDateTime.toISOString(),
      });

    if (checkError) {
      console.error('Error checking availability:', checkError);
      return new Response(
        JSON.stringify({ error: 'Failed to check availability', details: checkError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isAvailable) {
      return new Response(
        JSON.stringify({ 
          error: 'Specialist is not available at this time',
          available: false
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If check_only is true, just return availability status
    if (check_only) {
      return new Response(
        JSON.stringify({ 
          available: true,
          message: 'Specialist is available at this time'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create schedule entry
    const { data: schedule, error: scheduleError } = await supabaseClient
      .from('specialist_schedules')
      .insert({
        specialist_id,
        order_id,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        travel_buffer_minutes: 120, // 2 hours buffer
      })
      .select()
      .single();

    if (scheduleError) {
      console.error('Error creating schedule:', scheduleError);
      return new Response(
        JSON.stringify({ error: 'Failed to create schedule', details: scheduleError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get next available time for this specialist
    const { data: nextAvailable, error: nextError } = await supabaseClient
      .rpc('get_next_available_time', {
        _specialist_id: specialist_id,
        _duration_hours: hours_count,
      });

    if (nextError) {
      console.error('Error getting next available time:', nextError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        schedule,
        next_available_time: nextAvailable,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in manage-specialist-schedule:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
