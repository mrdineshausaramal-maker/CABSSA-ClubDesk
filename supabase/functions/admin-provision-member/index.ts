// ============================================================================
// Supabase Edge Function: admin-provision-member
// Privileged administrative member creation with Supabase Auth integration
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 1. Verify caller identity using their JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid JWT" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Check if caller has ADMIN role in profiles
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: callerProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("role, full_name")
      .or(`auth_user_id.eq.${callerUser.id},id.eq.${callerUser.id}`)
      .single();

    if (profileError || callerProfile?.role !== "ADMIN") {
      return new Response(JSON.stringify({ error: "Forbidden: Only Administrators can provision members" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Parse member payload
    const payload = await req.json();
    const {
      email,
      password,
      fullName,
      contactNumber,
      prnNumber,
      rollNumber,
      academicYear,
      division,
      designation,
      role = "CORE_MEMBER",
      domainId = null,
      personalVehicle = false,
      dob = null,
      profilePhotoUrl = null,
      dateOfJoining = new Date().toISOString().split("T")[0],
      status = "Active",
    } = payload;

    // Validation
    if (!email || !fullName || !prnNumber || !rollNumber || !academicYear || !division || !designation) {
      return new Response(JSON.stringify({ error: "Missing required fields for member provisioning" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Create Auth User in Supabase Auth
    const defaultPassword = password || `Cabssa@${new Date().getFullYear()}`;
    const { data: authCreated, error: createAuthError } = await adminClient.auth.admin.createUser({
      email,
      password: defaultPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName, role, prn: prnNumber },
    });

    if (createAuthError) {
      return new Response(JSON.stringify({ error: `Auth creation failed: ${createAuthError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authUserId = authCreated.user.id;

    // 5. Generate unique member ID (e.g. CABSSA-2026-089)
    const { count } = await adminClient.from("profiles").select("*", { count: "exact", head: true });
    const memberId = `CABSSA-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, "0")}`;

    // 6. Insert Profile record
    const { data: newProfile, error: insertError } = await adminClient
      .from("profiles")
      .insert({
        id: authUserId,
        auth_user_id: authUserId,
        member_id: memberId,
        full_name: fullName,
        email,
        contact_number: contactNumber,
        prn_number: prnNumber,
        roll_number: rollNumber,
        academic_year: academicYear,
        division,
        designation,
        role,
        domain_id: domainId,
        personal_vehicle: personalVehicle,
        dob,
        profile_photo_url: profilePhotoUrl,
        date_of_joining: dateOfJoining,
        status,
      })
      .select()
      .single();

    if (insertError) {
      // Rollback auth user if profile insertion failed
      await adminClient.auth.admin.deleteUser(authUserId);
      return new Response(JSON.stringify({ error: `Database profile insert failed: ${insertError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7. Record Activity Audit Log
    await adminClient.from("activity_logs").insert({
      actor_id: callerUser.id,
      actor_name: callerProfile.full_name,
      action: "MEMBER_PROVISIONED",
      entity_type: "MEMBER",
      entity_id: newProfile.id,
      details: {
        member_id: memberId,
        full_name: fullName,
        prn_number: prnNumber,
        role,
        domain_id: domainId,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Member successfully provisioned in Auth and Database",
        profile: newProfile,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
