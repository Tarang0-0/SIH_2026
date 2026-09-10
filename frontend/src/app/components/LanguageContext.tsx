'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Language = 'en' | 'hi';

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  isLanguageModalOpen: boolean;
  openLanguageModal: () => void;
  closeLanguageModal: () => void;
  t: (key: string, fallback?: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Brand
    brand_name: 'Namaste Rail',
    brand_tagline: 'Indian Railways Transit Intelligence',
    brand_prototype: 'Smart India Hackathon 2026 Prototype',

    // Navbar
    nav_overview: 'Overview',
    nav_control_room: 'Control Room',
    nav_ist: 'IST',
    nav_lang_toggle: 'हिन्दी',
    nav_lang_title: 'Change Language to Hindi',

    // Hero & Landing
    hero_live_badge: 'Live train tracking',
    hero_title_1: 'Find your train.',
    hero_title_2: 'Know what happens next.',
    hero_desc: 'Search by train number or name to see its live location, upcoming station, expected arrival, and delay.',
    search_card_tag: 'Namaste Rail tracker',
    search_card_title: 'Where is your train?',
    search_card_ready: 'Ready',
    search_input_label: 'Search train number or name',
    search_input_placeholder: 'Train number or name (e.g. 12951)',
    search_btn: 'Search',
    quick_corridors_title: 'Quick Select Corridors:',
    next_station_badge: 'Next station',
    delay_status_badge: 'Delay status',
    station_help_badge: 'Station help',
    search_subtext: 'Enter a train number for direct tracking, or choose a matching train from the suggestions.',
    search_no_results: 'No matching train found.',
    popular_tag_fast: 'Fast',
    popular_tag_express: 'Express',
    popular_tag_superfast: 'Superfast',

    // Feature Cards
    feature_1_title: 'Live Telemetry & GPS',
    feature_1_desc: 'Locomotive RTIS tracking updated at sub-minute intervals.',
    feature_2_title: 'Predictive ETA (P10-P90)',
    feature_2_desc: 'Dynamic machine learning arrival intervals with congestion factoring.',
    feature_3_title: 'Explainable Delay Reasons',
    feature_3_desc: 'Transparent root-cause diagnosis across weather, track & signals.',

    // Dashboard
    dash_on_schedule: 'ON SCHEDULE',
    dash_delayed: 'DELAYED',
    dash_severe_delay: 'SEVERE DELAY',
    dash_origin: 'Origin:',
    dash_destination: 'Destination:',
    dash_scheduled_halts: 'Scheduled Halts',
    dash_track_btn: 'Track',
    dash_upcoming_station: 'Upcoming station',
    dash_platform: 'Platform',
    dash_speed: 'Current Speed',
    dash_distance: 'Distance to Next Stop',
    dash_timeline_title: 'Halt Timetable & Progress',
    dash_stops: 'Stops',
    dash_current: 'Current',
    dash_choose_train: 'Choose a train to begin',
    dash_choose_desc: 'Search the live train directory first, then choose a train to inspect its current location and next stop.',
    dash_open_search: 'Open train search',
    dash_acquiring: 'Acquiring Live Transit Stream...',

    // Operator Console
    op_badge: 'Operations Dispatch Console • Restricted Access',
    op_title: 'Corridor Impact & Cascade Control',
    op_desc: 'Live corridor triage analyzing downstream station exposure from halted or delayed services. Correlates RTIS locomotive telemetry with station arrivals to identify potential headway conflicts.',
    op_passenger_search: 'Passenger Search',
    op_sign_out: 'Sign out',
    op_inspect_label: 'Train to Inspect',
    op_inspect_placeholder: 'Enter 5-digit train number (e.g. 12951)',
    op_depth_label: 'Lookahead Depth',
    op_depth_suffix: 'downstream stations',
    op_analyze_btn: 'Analyze Impact',
    op_ready_title: 'Ready for Corridor Triage',
    op_ready_desc: 'Enter a train number or choose a quick preset above to query real-time downstream station boards and identify services exposed to potential delays.',
    op_incident_telemetry: 'Incident Train Telemetry',
    op_halted: 'HALTED',
    op_downstream_title: 'Potential Downstream Exposure',
    op_services_count: 'Services in Corridor Window',
    op_diagnostics_title: 'Operational Data Diagnostics & Signal Quality',

    // Footer
    footer_mission: 'Next-generation dynamic train arrival prediction, RTIS live GPS telemetry, and explainable delay attribution engineered for Indian Railways transit modernization.',
    footer_license: 'License: MIT',
    footer_dpdpa: 'DPDPA 2023 Compliant',
    footer_wcag: 'WCAG 2.1 AA Accessible',
    footer_app_title: 'Application',
    footer_compliance_title: 'Governance & Compliance',
    footer_home_link: 'Home / Search',
    footer_control_link: 'Operator Control Room',
    footer_about_link: 'Architecture & SIH 2026',
    footer_privacy_link: 'Privacy Policy (DPDPA)',
    footer_terms_link: 'Terms of Service & Disclaimer',
    footer_cookies_link: 'Cookie & Storage Policy',
    footer_rights: 'All rights reserved.',
    footer_trademark_note: 'Non-Affiliation Notice: Indian Railways, IRCTC, CRIS, NTES, and RTIS are trademarks of their respective government authorities.',

    // Dashboard Extra
    dash_station_delay: 'Station Delay',
    dash_ai_confidence: 'AI Confidence',
    dash_expected_arrival: 'Expected Arrival',
    dash_target: 'Target',
    dash_causal_diagnosis: 'Causal Delay Diagnosis (SHAP Analysis)',
    dash_passenger_facilities: 'Passenger facilities',
    dash_nearby_at: 'Nearby at',
    dash_waiting_area: 'Waiting area',
    dash_find_nearest_waiting: 'Find the nearest mapped option',
    dash_canteen_food: 'Canteen & food',
    dash_find_nearby_food: 'Find nearby food options',
    dash_past_journey_timings: 'Past journey timings',
    dash_forecast_confidence: 'Forecast confidence',
    dash_route_progress: 'Route progress',
    dash_live_operations: 'Live operations',
    dash_transit_offline: 'Transit Data Offline',
    dash_departed: 'Departed',
    dash_delayed_stop: 'Delayed Stop',
    dash_upcoming: 'Upcoming',
    dash_currently_at: 'Currently at',
    dash_in_about: 'in about',
    dash_delay_at_station: 'Delay at this station',
    dash_scheduled: 'Scheduled',
    dash_observed_error: 'Latest observed error',
    dash_select_date_btn: 'Select Journey Date',
    dash_close_calendar: 'Close Calendar',
    dash_loading_calendar: 'Loading calendar…',
    dash_return_search: 'Return to train search',
    dash_full_route_note: 'Full route · next stop selected automatically',
    dash_planned_corridor: 'Planned train corridor',
    dash_completed_section: 'Completed section',
    dash_factor_identified: 'Identified Corridor Factor',
    dash_schedule_adherence: 'Optimal Schedule Adherence',
    dash_station_help_subtitle: 'Optional station support while you wait for the train.',
    dash_checking_options: 'Checking station options…',
    dash_facility_unavailable: 'Verified station facility data is unavailable; these links open nearby map results instead.',
    dash_assigned: 'Assigned',
    dash_reached: 'Reached',
    dash_departed_col: 'Departed',
    dash_delay_col: 'Delay',
    dash_station_col: 'Station',
    dash_recorded_timings: 'Recorded timings',
    dash_no_recorded_run: 'No recorded run',
    dash_timetable_legend_note: 'Assigned = scheduled arrival · Reached/Departed = stored provider timestamps',
    dash_journey_calendar: 'Journey Calendar',
    dash_pick_date_desc: 'Pick any date from the interactive calendar to view recorded arrivals, departures, and delay explanations.',
    dash_track_selected_date: 'Track Selected Date',

    // Operator Extra
    op_quick_preset: 'Quick Preset:',
    op_downstream_halts: 'Downstream Monitored Corridor',
    op_movement_state: 'Movement State',
    op_current_velocity: 'Current Velocity',
    op_journey_date: 'Journey Date',
    op_signal_source: 'Signal Source',
    op_telemetry_observed: 'Telemetry observed:',
    op_train_service: 'Train Service',
    op_halt_station: 'Halt Station',
    op_expected_eta: 'Expected ETA',
    op_delay_state: 'Delay State',
    op_impact_vector: 'Impact Vector',
    op_block_contention: 'Occupied block contention',
    op_maint_block: 'Maintenance block',
    op_downstream_window: 'Downstream station window',
    op_no_trains: 'No other trains were returned by the live boards in this lookahead corridor window.',
    op_correlates_note: 'Note: Correlates live arrivals within downstream windows. Does not assume rigid physical interlock blockage.',
    op_occupancy_feed: 'Occupancy Feed',
    op_causality_verif: 'Causality Verification',
    op_station_board_health: 'Station Board Health',
    op_telemetric_provider: 'Telemetric Provider',
    op_active: 'Active',
    op_standby: 'Simulated / Standby',
    op_predictive_corr: 'Predictive Correlation',
    op_all_boards_active: '100% Boards Active',
    op_offline: 'Offline',
    op_auth_session: 'Authenticating dispatch session…',
    op_enter_train_err: 'Enter a train number to inspect the live downstream impact.',
    op_analyzing: 'Analyzing…',
    op_on_time_badge: 'On time (0m)',
    op_moderate_delay: 'moderate',
    op_critical_delay: 'critical',

    // Admin & Auth
    admin_title: 'Namaste Rail',
    admin_subtitle: 'Indian Railways Transit Operations & Dispatch Console',
    admin_system_node: 'RailPulse Node: 0xIR-NDLS',
    admin_return_label: 'RETURN TO PASSENGER DIRECTORY',
    admin_portal_title: 'Divisional Operator Authentication',
    admin_portal_subtitle: 'Restricted operational control room. Authorized railway personnel only.',
    admin_username: 'USERNAME',
    admin_password: 'PASSWORD',
    admin_username_placeholder: 'Enter username',
    admin_password_placeholder: 'Enter password',
    admin_submit: 'SUBMIT',
    admin_submitting: 'SUBMITTING…',
    admin_restricted: 'RESTRICTED',
    admin_secure_session: 'SECURE SHA-256 SESSION',
    admin_auth_failed: 'Authentication sequence rejected. Check operator credentials (admin / admin@2026).',
    admin_enter_key: 'Enter Operator Passkey',
    admin_login_btn: 'Access Control Room',
    admin_back: 'Back to Passenger Search',

    // About Page
    about_hero_badge: 'SMART INDIA HACKATHON 2026',
    about_hero_title: 'About Project Namaste Rail',
    about_hero_subtitle: 'Pioneering dynamic transit intelligence and transparent delay attribution for the world’s fourth largest railway network.',
    about_challenge_badge: 'The Challenge',
    about_challenge_title: 'Transit Uncertainty at Scale',
    about_challenge_desc: 'Large railway networks experience congestion and cascading delays that frequently render published timetables inaccurate. Standard enquiry systems often lack predictive depth and transparent explanations for passengers.',
    about_solution_badge: 'The Solution',
    about_solution_title: 'Data-Driven Precision',
    about_solution_desc: 'Namaste Rail integrates real-time locomotive GPS streams from the Real-Time Train Information System (RTIS) with multi-quantile gradient boosting. The system continuously refines arrival estimates and uses explainable AI to transparently account for delays.',
    about_specs_badge: 'Technical Specifications',
    about_specs_title: 'Stack & Infrastructure Matrix',
    about_ml_core_cat: 'Machine Learning Core',
    about_ml_core_title: 'XGBoost Multi-Quantile',
    about_ml_core_desc: 'Pinball loss regression for P10, P50, and P90 uncertainty intervals.',
    about_explain_cat: 'Explainability Engine',
    about_explain_title: 'Tree SHAP Factor Isolation',
    about_explain_desc: 'Feature attribution isolating congestion, weather, and section headway.',
    about_api_cat: 'High-Performance API',
    about_api_title: 'FastAPI + Asynchronous SSE',
    about_api_desc: 'Server-Sent Events streaming telemetry from the configured live provider.',
    about_console_cat: 'Operational Console',
    about_console_title: 'Next.js 16 + Leaflet GIS',
    about_console_desc: 'Dynamic route polyline interpolation with zero hardcoded coordinate tables.',
    about_launch_btn: 'Launch Operations Console',
    about_title: 'Architecture & SIH 2026 Innovation',
    about_subtitle: 'Next-generation dynamic train arrival prediction, RTIS live GPS telemetry, and explainable delay diagnosis.',

    // Features Page
    features_hero_badge: 'ENGINEERING ARCHITECTURE',
    features_hero_title: 'System Capabilities & Design',
    features_hero_subtitle: 'A comprehensive overview of the machine learning pipelines, geospatial algorithms, and telemetry services powering Namaste Rail.',
    features_pipeline_badge: 'End-to-End Pipeline',
    features_pipeline_title: 'Data Flow & Predictive Stack',
    features_step1_badge: 'DATA INGESTION',
    features_step1_title: 'RTIS & Schedule Integration',
    features_step1_desc: 'Ingests timestamped live train telemetry from the configured authorised provider and combines it with the route timetable catalog.',
    features_step1_metric: 'Provider-backed ingestion',
    features_step2_badge: 'ML INFERENCE',
    features_step2_title: 'Multi-Quantile XGBoost Engine',
    features_step2_desc: 'Computes P10, P50, and P90 arrival quantiles from the deployed feature contract, with live signals added only when provider-backed training data supports them.',
    features_step2_metric: 'Chronological holdout validation',
    features_step3_badge: 'EXPLAINABLE AI',
    features_step3_title: 'Tree SHAP Causal Attribution',
    features_step3_desc: 'Deconstructs predictions into human-readable feature contributions and reports the model factors available for the current request.',
    features_step3_metric: 'Transparent feature attribution',
    features_step4_badge: 'CLIENT TELEMETRY',
    features_step4_title: 'Real-Time SSE Gateway',
    features_step4_desc: 'Streams live coordinates, speed, and revised downstream station arrival estimates to client dashboards with zero manual page refreshes.',
    features_step4_metric: 'Provider timestamped updates',
    features_deep1_title: 'Multi-Quantile Forecasting (P10 / P50 / P90)',
    features_deep1_desc: 'Standard transit APIs only report single-point arrival estimates that degrade when trains encounter congestion. Namaste Rail fits dedicated pinball loss regressors to compute empirical prediction intervals:',
    features_p10_label: 'P10 (Optimistic):',
    features_p10_desc: 'Lower-bound ETA interval',
    features_p50_label: 'P50 (Expected Median):',
    features_p50_desc: 'Primary ETA estimate',
    features_p90_label: 'P90 (Conservative):',
    features_p90_desc: 'Upper-bound ETA interval',
    features_deep2_title: 'SHAP Causal Delay Decomposition',
    features_deep2_desc: 'Passengers and operators can inspect exact causal drivers. Tree SHAP isolates individual feature contributions for each downstream halt:',
    features_deep2_detail: 'The API returns request-specific feature attribution when the trained model and its explainer are available. Factors include section blockages, weather severity, and priority rake crossings.',
    features_cta_title: 'Ready to inspect a running train?',
    features_cta_desc: 'Experience the dual-pane operational dashboard with live corridor tracks and real-time GIS route maps.',
    features_cta_btn: 'Open Operations Dashboard',
    features_title: 'System Architecture & Engineering',
    features_subtitle: 'Explore the AI pipeline, RTIS streaming gateway, and multi-quantile ETA prediction engine.',

    // Footer Extra
    footer_live_dashboard: 'Live Dashboard',
    footer_live_map: 'Live Map',
    footer_terms_privacy: 'Terms & Privacy',
    footer_mit_license: 'Namaste Rail Contributors • MIT License',
    footer_independent_note: 'Independent student research prototype. Not affiliated with Ministry of Railways or IRCTC.',

    // Cookie Notice
    cookie_title: 'Data Minimization & Storage Notice',
    cookie_desc: 'Namaste Rail uses strictly functional local storage for theme settings and session state. We do not track you, profile your behavior, or use third-party advertising cookies. By using this service, you acknowledge our',
    cookie_privacy_link: 'Privacy Policy',
    cookie_and: 'and',
    cookie_storage_link: 'Storage Policy',
    cookie_learn_more: 'Learn More',
    cookie_accept: 'Accept & Continue',

    // Legal & Shared
    nav_home: 'Home',
    terms_title: 'Terms & Conditions',
    privacy_title: 'Privacy Policy',
    cookies_title: 'Cookie & Storage Policy',
    last_updated: 'Last Updated: September 10, 2026 • Effective Date: September 10, 2026',

    // Modal
    modal_welcome: 'Welcome to Namaste Rail',
    modal_subtitle: 'Select your preferred language / अपनी पसंदीदा भाषा चुनें',
    modal_en_title: 'English',
    modal_en_desc: 'Access Indian Railways Transit Intelligence, live RTIS telemetry & arrival predictions in English.',
    modal_hi_title: 'हिन्दी (Hindi)',
    modal_hi_desc: 'भारतीय रेल लाइव ट्रेन ट्रैकिंग, आगमन समय एवं देरी पूर्वानुमान हिन्दी में देखें।',
    modal_confirm: 'Open Namaste Rail',
    modal_change_anytime: 'You can change this anytime from the top navigation bar.',
  },
  hi: {
    // Brand
    brand_name: 'नमस्ते रेल',
    brand_tagline: 'भारतीय रेल ट्रांजिट इंटेलिजेंस',
    brand_prototype: 'स्मार्ट इंडिया हैकाथॉन 2026 प्रोटोटाइप',

    // Navbar
    nav_overview: 'अवलोकन',
    nav_control_room: 'कंट्रोल रूम',
    nav_ist: 'भारतीय समय',
    nav_lang_toggle: 'English',
    nav_lang_title: 'अंग्रेज़ी में बदलें (Switch to English)',

    // Hero & Landing
    hero_live_badge: 'लाइव ट्रेन ट्रैकिंग',
    hero_title_1: 'अपनी ट्रेन खोजें।',
    hero_title_2: 'जानिए आगे क्या होगा।',
    hero_desc: 'लाइव स्थान, आगामी स्टेशन, अनुमानित आगमन समय और संभावित देरी देखने के लिए ट्रेन नंबर या नाम से खोजें।',
    search_card_tag: 'नमस्ते रेल ट्रैकर',
    search_card_title: 'आपकी ट्रेन कहाँ है?',
    search_card_ready: 'तैयार',
    search_input_label: 'ट्रेन नंबर या नाम दर्ज करें',
    search_input_placeholder: 'ट्रेन नंबर या नाम (उदा. 12951)',
    search_btn: 'खोजें',
    quick_corridors_title: 'त्वरित प्रमुख ट्रेनें:',
    next_station_badge: 'आगामी स्टेशन',
    delay_status_badge: 'विलंब स्थिति',
    station_help_badge: 'स्टेशन सुविधाएँ',
    search_subtext: 'सीधे लाइव ट्रैकिंग के लिए ट्रेन नंबर दर्ज करें, या सुझाव सूची में से चुनें।',
    search_no_results: 'कोई मेल खाती ट्रेन नहीं मिली।',
    popular_tag_fast: 'फ़ास्ट',
    popular_tag_express: 'एक्सप्रेस',
    popular_tag_superfast: 'सुपरफ़ास्ट',

    // Feature Cards
    feature_1_title: 'लाइव टेलीमेट्री एवं जीपीएस',
    feature_1_desc: 'लोकोमोटिव आरटीआईएस सैटेलाइट ट्रैकिंग, सब-मिनट अंतराल पर अपडेट।',
    feature_2_title: 'अनुमानित आगमन समय (P10-P90)',
    feature_2_desc: 'मशीन लर्निंग द्वारा ट्रैक भीड़ एवं सिग्नल आधारित आगमन पूर्वानुमान।',
    feature_3_title: 'देरी का स्पष्ट कारण',
    feature_3_desc: 'मौसम, ट्रैक और सिग्नल स्थिति के आधार पर पारदर्शी कारण विश्लेषण।',

    // Dashboard
    dash_on_schedule: 'समय पर',
    dash_delayed: 'विलंबित',
    dash_severe_delay: 'अत्यधिक विलंब',
    dash_origin: 'प्रस्थान:',
    dash_destination: 'गंतव्य:',
    dash_scheduled_halts: 'निर्धारित ठहराव',
    dash_track_btn: 'ट्रैक करें',
    dash_upcoming_station: 'आगामी स्टेशन',
    dash_platform: 'प्लेटफ़ॉर्म',
    dash_speed: 'वर्तमान गति',
    dash_distance: 'अगले स्टेशन की दूरी',
    dash_timeline_title: 'स्टेशन समय सारणी एवं यात्रा प्रगति',
    dash_stops: 'ठहराव',
    dash_current: 'वर्तमान स्थिति',
    dash_choose_train: 'शुरू करने के लिए एक ट्रेन चुनें',
    dash_choose_desc: 'पहले लाइव ट्रेन निर्देशिका खोजें, फिर उसका वर्तमान स्थान और अगला ठहराव देखने के लिए ट्रेन चुनें।',
    dash_open_search: 'ट्रेन खोज खोलें',
    dash_acquiring: 'लाइव टेलीमेट्री स्ट्रीम प्राप्त की जा रही है...',

    // Operator Console
    op_badge: 'परिचालन डिस्पैच कंसोल • प्रतिबंधित पहुंच',
    op_title: 'कॉरिडोर प्रभाव एवं कैस्केड नियंत्रण',
    op_desc: 'रुकी हुई या विलंबित ट्रेनों से आगे के स्टेशनों पर पड़ने वाले प्रभाव का वास्तविक समय में विश्लेषण। आरटीआईएस टेलीमेट्री से संभावित हेडवे टकराव की पहचान।',
    op_passenger_search: 'यात्री खोज',
    op_sign_out: 'लॉग आउट',
    op_inspect_label: 'निरीक्षण हेतु ट्रेन',
    op_inspect_placeholder: '5-अंकों का ट्रेन नंबर दर्ज करें (उदा. 12951)',
    op_depth_label: 'डाउनस्ट्रीम गहराई',
    op_depth_suffix: 'आगे के स्टेशन',
    op_analyze_btn: 'प्रभाव विश्लेषण करें',
    op_ready_title: 'कॉरिडोर विश्लेषण के लिए तैयार',
    op_ready_desc: 'वास्तविक समय में डाउनस्ट्रीम स्टेशन बोर्डों को देखने और प्रभावित सेवाओं की पहचान के लिए ऊपर ट्रेन नंबर दर्ज करें।',
    op_incident_telemetry: 'घटनाग्रस्त ट्रेन टेलीमेट्री',
    op_halted: 'रुकी हुई (HALTED)',
    op_downstream_title: 'संभावित डाउनस्ट्रीम प्रभाव',
    op_services_count: 'कॉरिडोर विंडो में ट्रेनें',
    op_diagnostics_title: 'परिचालन डेटा डायग्नोस्टिक्स एवं सिग्नल गुणवत्ता',

    // Footer
    footer_mission: 'भारतीय रेल के आधुनिकीकरण के लिए अगली पीढ़ी का डायनामिक ट्रेन आगमन पूर्वानुमान, आरटीआईएस लाइव जीपीएस टेलीमेट्री और पारदर्शी विलंब विश्लेषण।',
    footer_license: 'लाइसेंस: एमआईटी',
    footer_dpdpa: 'डीपीडीपीए 2023 अनुपालक',
    footer_wcag: 'डब्ल्यूसीएजी 2.1 एए सुलभ',
    footer_app_title: 'एप्लीकेशन',
    footer_compliance_title: 'अनुपालन एवं नीतियां',
    footer_home_link: 'मुख्य पृष्ठ / खोज',
    footer_control_link: 'ऑपरेटर कंट्रोल रूम',
    footer_about_link: 'आर्किटेक्चर एवं एसआईएच 2026',
    footer_privacy_link: 'गोपनीयता नीति (DPDPA)',
    footer_terms_link: 'नियम एवं सेवा शर्तें',
    footer_cookies_link: 'कुकी एवं स्टोरेज नीति',
    footer_rights: 'सर्वाधिकार सुरक्षित।',
    footer_trademark_note: 'गैर-संबद्धता सूचना: भारतीय रेल, आईआरसीटीसी, क्रिस, एनटीईएस और आरटीआईएस उनके संबंधित सरकारी प्राधिकरणों के ट्रेडमार्क हैं।',

    // Dashboard Extra
    dash_station_delay: 'स्टेशन विलंब',
    dash_ai_confidence: 'एआई विश्वसनीयता',
    dash_expected_arrival: 'अनुमानित आगमन',
    dash_target: 'लक्ष्य',
    dash_causal_diagnosis: 'विलंब कारण निदान (SHAP विश्लेषण)',
    dash_passenger_facilities: 'यात्री सुविधाएँ',
    dash_nearby_at: 'निकटवर्ती सुविधाएँ:',
    dash_waiting_area: 'प्रतीक्षालय',
    dash_find_nearest_waiting: 'निकटतम प्रतीक्षालय विकल्प देखें',
    dash_canteen_food: 'खान-पान एवं कैंटीन',
    dash_find_nearby_food: 'निकटतम भोजन विकल्प खोजें',
    dash_past_journey_timings: 'पिछली यात्राओं का समय',
    dash_forecast_confidence: 'पूर्वानुमान विश्वसनीयता',
    dash_route_progress: 'मार्ग प्रगति',
    dash_live_operations: 'लाइव परिचालन',
    dash_transit_offline: 'ट्रांजिट डेटा ऑफ़लाइन',
    dash_departed: 'प्रस्थान कर चुकी',
    dash_delayed_stop: 'विलंबित ठहराव',
    dash_upcoming: 'आगामी',
    dash_currently_at: 'वर्तमान में',
    dash_in_about: 'लगभग',
    dash_delay_at_station: 'इस स्टेशन पर विलंब',
    dash_scheduled: 'निर्धारित',
    dash_observed_error: 'अंतिम प्रेक्षित त्रुटि',
    dash_select_date_btn: 'यात्रा तिथि चुनें',
    dash_close_calendar: 'कैलेंडर बंद करें',
    dash_loading_calendar: 'कैलेंडर लोड हो रहा है…',
    dash_return_search: 'ट्रेन खोज पर वापस जाएं',
    dash_full_route_note: 'संपूर्ण मार्ग · अगला ठहराव स्वतः चयनित',
    dash_planned_corridor: 'निर्धारित ट्रेन कॉरिडोर',
    dash_completed_section: 'पूर्ण किया गया भाग',
    dash_factor_identified: 'पहचाना गया कॉरिडोर कारक',
    dash_schedule_adherence: 'उत्कृष्ट समयबद्ध परिचालन',
    dash_station_help_subtitle: 'ट्रेन प्रतीक्षा के दौरान स्टेशन सहायता विकल्प।',
    dash_checking_options: 'स्टेशन विकल्प जांचे जा रहे हैं…',
    dash_facility_unavailable: 'प्रमाणित स्टेशन सुविधा डेटा अनुपलब्ध है; ये लिंक आस-पास के मानचित्र परिणाम खोलते हैं।',
    dash_assigned: 'निर्धारित',
    dash_reached: 'पहुंची',
    dash_departed_col: 'रवाना',
    dash_delay_col: 'विलंब',
    dash_station_col: 'स्टेशन',
    dash_recorded_timings: 'दर्ज किया गया समय',
    dash_no_recorded_run: 'कोई दर्ज यात्रा नहीं',
    dash_timetable_legend_note: 'निर्धारित = समय सारणी आगमन · पहुंची/रवाना = सहेजे गए टाइमस्टैम्प',
    dash_journey_calendar: 'यात्रा कैलेंडर',
    dash_pick_date_desc: 'आगमन, प्रस्थान और विलंब विवरण देखने के लिए कैलेंडर से कोई भी तारीख चुनें।',
    dash_track_selected_date: 'चयनित तिथि को ट्रैक करें',

    // Operator Extra
    op_quick_preset: 'त्वरित चयन:',
    op_downstream_halts: 'निगरानी अंतर्गत डाउनस्ट्रीम कॉरिडोर',
    op_movement_state: 'गति स्थिति',
    op_current_velocity: 'वर्तमान गति',
    op_journey_date: 'यात्रा तिथि',
    op_signal_source: 'सिग्नल स्रोत',
    op_telemetry_observed: 'टेलीमेट्री प्रेक्षित समय:',
    op_train_service: 'ट्रेन सेवा',
    op_halt_station: 'ठहराव स्टेशन',
    op_expected_eta: 'अनुमानित ईटीए',
    op_delay_state: 'विलंब स्थिति',
    op_impact_vector: 'प्रभाव विश्लेषण',
    op_block_contention: 'ऑक्यूपाइड ब्लॉक टकराव',
    op_maint_block: 'रखरखाव ब्लॉक',
    op_downstream_window: 'डाउनस्ट्रीम स्टेशन विंडो',
    op_no_trains: 'इस लुकअहेड कॉरिडोर विंडो में लाइव बोर्डों द्वारा कोई अन्य ट्रेन नहीं पाई गई।',
    op_correlates_note: 'नोट: डाउनस्ट्रीम विंडो के भीतर लाइव आगमन को सहसंबंधित करता है। कठोर भौतिक इंटरलॉक रुकावट नहीं मानता।',
    op_occupancy_feed: 'ऑक्यूपेंसी फ़ीड',
    op_causality_verif: 'कारण सत्यापन',
    op_station_board_health: 'स्टेशन बोर्ड स्थिति',
    op_telemetric_provider: 'टेलीमेट्रिक प्रदाता',
    op_active: 'सक्रिय',
    op_standby: 'सिम्युलेटेड / स्टैंडबाय',
    op_predictive_corr: 'पूर्वानुमानित सहसंबंध',
    op_all_boards_active: '100% बोर्ड सक्रिय',
    op_offline: 'ऑफ़लाइन',
    op_auth_session: 'डिस्पैच सत्र प्रमाणित किया जा रहा है…',
    op_enter_train_err: 'लाइव डाउनस्ट्रीम प्रभाव का निरीक्षण करने के लिए कृपया ट्रेन नंबर दर्ज करें।',
    op_analyzing: 'विश्लेषण हो रहा है…',
    op_on_time_badge: 'समय पर (0m)',
    op_moderate_delay: 'मध्यम विलंब',
    op_critical_delay: 'गंभीर विलंब',

    // Admin & Auth
    admin_title: 'नमस्ते रेल',
    admin_subtitle: 'भारतीय रेल परिचालन एवं डिस्पैच कंसोल',
    admin_system_node: 'रेलपल्स नोड: 0xIR-NDLS',
    admin_return_label: 'यात्री निर्देशिका पर वापस जाएं',
    admin_portal_title: 'मंडल परिचालन प्रमाणीकरण',
    admin_portal_subtitle: 'प्रतिबंधित परिचालन कंट्रोल रूम। केवल अधिकृत रेल कर्मियों के लिए।',
    admin_username: 'उपयोगकर्ता नाम (USERNAME)',
    admin_password: 'पासवर्ड (PASSWORD)',
    admin_username_placeholder: 'उपयोगकर्ता नाम दर्ज करें',
    admin_password_placeholder: 'पासवर्ड दर्ज करें',
    admin_submit: 'प्रवेश करें (SUBMIT)',
    admin_submitting: 'सत्यापन हो रहा है…',
    admin_restricted: 'प्रतिबंधित',
    admin_secure_session: 'सुरक्षित SHA-256 सत्र',
    admin_auth_failed: 'प्रमाणीकरण अस्वीकृत। कृपया ऑपरेटर क्रेडेंशियल जांचें (admin / admin@2026)।',
    admin_enter_key: 'ऑपरेटर पासकी दर्ज करें',
    admin_login_btn: 'कंट्रोल रूम में प्रवेश करें',
    admin_back: 'यात्री खोज पर वापस जाएं',

    // About Page
    about_hero_badge: 'स्मार्ट इंडिया हैकाथॉन 2026',
    about_hero_title: 'प्रोजेक्ट नमस्ते रेल के बारे में',
    about_hero_subtitle: 'विश्व के चौथे सबसे बड़े रेल नेटवर्क के लिए गतिशील पारगमन विश्लेषण एवं पारदर्शी विलंब निदान।',
    about_challenge_badge: 'चुनौती',
    about_challenge_title: 'व्यापक स्तर पर पारगमन अनिश्चितता',
    about_challenge_desc: 'बड़े रेल नेटवर्कों में भीड़भाड़ और कैस्केडिंग देरी के कारण अक्सर प्रकाशित समय सारणी प्रभावित होती है। सामान्य पूछताछ प्रणालियों में भविष्यसूचक गहराई और पारदर्शी कारणों की कमी होती है।',
    about_solution_badge: 'समाधान',
    about_solution_title: 'डेटा-संचालित सटीकता',
    about_solution_desc: 'नमस्ते रेल वास्तविक समय लोकोमोटिव आरटीआईएस जीपीएस स्ट्रीम को मल्टी-क्वांटाइल ग्रेडिएंट बूस्टिंग के साथ एकीकृत करता है और पारदर्शी एआई द्वारा देरी के कारणों का विश्लेषण करता है।',
    about_specs_badge: 'तकनीकी विवरण',
    about_specs_title: 'स्टैक एवं इंफ्रास्ट्रक्चर मैट्रिक्स',
    about_ml_core_cat: 'मशीन लर्निंग कोर',
    about_ml_core_title: 'एक्सजीबूस्ट मल्टी-क्वांटाइल',
    about_ml_core_desc: 'P10, P50 एवं P90 अनिश्चितता अंतरालों के लिए पिनबॉल लॉस रिग्रेशन।',
    about_explain_cat: 'व्याख्यात्मक इंजन',
    about_explain_title: 'ट्री SHAP कारक पृथक्करण',
    about_explain_desc: 'भीड़भाड़, मौसम एवं सेक्शन हेडवे को अलग करने वाला फीचर एट्रिब्यूशन।',
    about_api_cat: 'उच्च-प्रदर्शन एपीआई',
    about_api_title: 'फास्टएपीआई + एसिंक्रोनस एसएसई',
    about_api_desc: 'कॉन्फ़िगर किए गए लाइव प्रदाता से सर्वर-सेंट इवेंट्स टेलीमेट्री स्ट्रीमिंग।',
    about_console_cat: 'परिचालन कंसोल',
    about_console_title: 'नेक्स्ट.जेएस 16 + लीफ़लेट जीआईएस',
    about_console_desc: 'शून्य हार्डकोडेड निर्देशांक तालिकाओं के साथ डायनामिक मार्ग पॉलीलाइन इंटरपोलेशन।',
    about_launch_btn: 'परिचालन कंसोल शुरू करें',
    about_title: 'आर्किटेक्चर एवं एसआईएच 2026 नवाचार',
    about_subtitle: 'अगली पीढ़ी का डायनामिक ट्रेन आगमन पूर्वानुमान, आरटीआईएस लाइव जीपीएस टेलीमेट्री और पारदर्शी विलंब विश्लेषण।',

    // Features Page
    features_hero_badge: 'इंजीनियरिंग आर्किटेक्चर',
    features_hero_title: 'सिस्टम क्षमताएं एवं डिज़ाइन',
    features_hero_subtitle: 'नमस्ते रेल को संचालित करने वाली मशीन लर्निंग पाइपलाइन, भू-स्थानिक एल्गोरिदम एवं टेलीमेट्री सेवाओं का संपूर्ण विवरण।',
    features_pipeline_badge: 'एंड-टू-एंड पाइपलाइन',
    features_pipeline_title: 'डेटा प्रवाह एवं भविष्यसूचक स्टैक',
    features_step1_badge: 'डेटा अंतर्ग्रहण',
    features_step1_title: 'आरटीआईएस एवं समय सारणी एकीकरण',
    features_step1_desc: 'अधिकृत प्रदाता से टाइमस्टैम्प्ड लाइव ट्रेन टेलीमेट्री ग्रहण कर रूट टाइमटेबल कैटलॉग के साथ जोड़ता है।',
    features_step1_metric: 'प्रदाता-समर्थित अंतर्ग्रहण',
    features_step2_badge: 'एमएल अनुमान',
    features_step2_title: 'मल्टी-क्वांटाइल एक्सजीबूस्ट इंजन',
    features_step2_desc: 'तैनात फीचर अनुबंध से P10, P50 और P90 आगमन क्वांटाइल की गणना करता है, केवल प्रदाता-समर्थित डेटा के आधार पर।',
    features_step2_metric: 'कालानुक्रमिक होल्डआउट सत्यापन',
    features_step3_badge: 'व्याख्यात्मक एआई',
    features_step3_title: 'ट्री SHAP कारण निर्धारण',
    features_step3_desc: 'पूर्वानुमानों को समझने योग्य फीचर योगदानों में विभाजित करता है और वर्तमान अनुरोध के लिए उपलब्ध मॉडल कारकों की रिपोर्ट करता है।',
    features_step3_metric: 'पारदर्शी फीचर एट्रिब्यूशन',
    features_step4_badge: 'क्लाइंट टेलीमेट्री',
    features_step4_title: 'रीयल-टाइम एसएसई गेटवे',
    features_step4_desc: 'क्लाइंट डैशबोर्ड पर लाइव निर्देशांक, गति एवं संशोधित डाउनस्ट्रीम स्टेशन आगमन अनुमान स्ट्रीम करता है, बिना रिफ्रेश किए।',
    features_step4_metric: 'प्रदाता टाइमस्टैम्प्ड अपडेट',
    features_deep1_title: 'मल्टी-क्वांटाइल पूर्वानुमान (P10 / P50 / P90)',
    features_deep1_desc: 'पारंपरिक ट्रांजिट एपीआई केवल एकल-बिंदु आगमन अनुमान प्रदान करते हैं जो भीड़भाड़ के समय अप्रभावी हो जाते हैं। नमस्ते रेल समर्पित पिनबॉल लॉस रिग्रेशन का उपयोग करता है:',
    features_p10_label: 'P10 (आशावादी):',
    features_p10_desc: 'न्यूनतम ईटीए अंतराल',
    features_p50_label: 'P50 (अपेक्षित माध्यिका):',
    features_p50_desc: 'प्राथमिक ईटीए अनुमान',
    features_p90_label: 'P90 (रूढ़िवादी):',
    features_p90_desc: 'अधिकतम ईटीए अंतराल',
    features_deep2_title: 'SHAP विलंब कारण विश्लेषण',
    features_deep2_desc: 'यात्री और ऑपरेटर वास्तविक कारणों की जांच कर सकते हैं। ट्री SHAP प्रत्येक डाउनस्ट्रीम ठहराव के लिए व्यक्तिगत फीचर योगदान को अलग करता है:',
    features_deep2_detail: 'प्रशिक्षित मॉडल और उसका एक्सप्लेनर उपलब्ध होने पर एपीआई अनुरोध-विशिष्ट फीचर एट्रिब्यूशन प्रदान करता है। कारकों में सेक्शन रुकावटें, मौसम की गंभीरता और क्रॉसिंग शामिल हैं।',
    features_cta_title: 'चलती ट्रेन का निरीक्षण करने के लिए तैयार हैं?',
    features_cta_desc: 'लाइव कॉरिडोर ट्रैक और वास्तविक समय जीआईएस रूट मैप के साथ परिचालन डैशबोर्ड का अनुभव करें।',
    features_cta_btn: 'परिचालन डैशबोर्ड खोलें',
    features_title: 'सिस्टम आर्किटेक्चर एवं इंजीनियरिंग',
    features_subtitle: 'एआई पाइपलाइन, आरटीआईएस स्ट्रीमिंग गेटवे और मल्टी-क्वांटाइल ईटीए इंजन का अन्वेषण करें।',

    // Footer Extra
    footer_live_dashboard: 'लाइव डैशबोर्ड',
    footer_live_map: 'लाइव मैप',
    footer_terms_privacy: 'नियम एवं गोपनीयता',
    footer_mit_license: 'नमस्ते रेल योगदानकर्ता • एमआईटी लाइसेंस',
    footer_independent_note: 'स्वतंत्र छात्र अनुसंधान प्रोटोटाइप। रेल मंत्रालय या आईआरसीटीसी से संबद्ध नहीं।',

    // Cookie Notice
    cookie_title: 'डेटा न्यूनीकरण एवं संग्रहण सूचना',
    cookie_desc: 'नमस्ते रेल थीम सेटिंग्स और सत्र स्थिति के लिए केवल कार्यात्मक स्थानीय संग्रहण का उपयोग करता है। हम आपको ट्रैक नहीं करते, न ही विज्ञापन कुकीज़ का उपयोग करते हैं। इस सेवा का उपयोग करके, आप हमारी',
    cookie_privacy_link: 'गोपनीयता नीति',
    cookie_and: 'एवं',
    cookie_storage_link: 'संग्रहण नीति',
    cookie_learn_more: 'अधिक जानें',
    cookie_accept: 'स्वीकार करें और जारी रखें',

    // Legal & Shared
    nav_home: 'मुख्य पृष्ठ',
    terms_title: 'नियम एवं शर्तें',
    privacy_title: 'गोपनीयता नीति',
    cookies_title: 'कुकी एवं संग्रहण नीति',
    last_updated: 'अंतिम अद्यतन: 10 सितंबर 2026 • प्रभावी तिथि: 10 सितंबर 2026',

    // Modal
    modal_welcome: 'नमस्ते रेल में आपका स्वागत है',
    modal_subtitle: 'Select your preferred language / अपनी पसंदीदा भाषा चुनें',
    modal_en_title: 'English',
    modal_en_desc: 'Access Indian Railways Transit Intelligence, live RTIS telemetry & arrival predictions in English.',
    modal_hi_title: 'हिन्दी (Hindi)',
    modal_hi_desc: 'भारतीय रेल लाइव ट्रेन ट्रैकिंग, आगमन समय एवं देरी पूर्वानुमान हिन्दी में देखें।',
    modal_confirm: 'नमस्ते रेल खोलें',
    modal_change_anytime: 'आप इसे शीर्ष नेविगेशन बार से कभी भी बदल सकते हैं।',
  },
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  toggleLanguage: () => {},
  isLanguageModalOpen: false,
  openLanguageModal: () => {},
  closeLanguageModal: () => {},
  t: (key: string, fallback?: string) => fallback || key,
});

const STORAGE_KEY = 'railpulse-lang';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (stored === 'en' || stored === 'hi') {
        setLanguageState(stored);
        document.documentElement.lang = stored;
      } else {
        // First visit: show the language selection modal
        setIsLanguageModalOpen(true);
      }
    } catch {
      // Ignore localStorage issues
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    } catch {
      // Ignore storage errors
    }
  };

  const toggleLanguage = () => {
    const next = language === 'en' ? 'hi' : 'en';
    setLanguage(next);
  };

  const openLanguageModal = () => setIsLanguageModalOpen(true);
  const closeLanguageModal = () => setIsLanguageModalOpen(false);

  const t = (key: string, fallback?: string): string => {
    const langDict = translations[language];
    if (langDict && key in langDict) {
      return langDict[key];
    }
    // Fallback to English dictionary
    if (translations.en && key in translations.en) {
      return translations.en[key];
    }
    return fallback || key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        isLanguageModalOpen,
        openLanguageModal,
        closeLanguageModal,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
