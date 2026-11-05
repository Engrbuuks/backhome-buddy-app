<?php
/**
 * Backhome Buddy theme.
 *
 * The catalogue, the prices, the states and the vetting steps are NOT written
 * into this theme. They are read from the app and cached.
 *
 * That is the whole reason this theme exists in the form it does. The previous
 * site kept its own copy of the catalogue, so when two services were retired
 * the website went on advertising them, and it carried figures for tasks
 * completed and client satisfaction that nothing in the system had ever
 * produced. A hand maintained copy of a catalogue always ends that way.
 *
 * Deactivate a service in the app's admin and it leaves this website the same
 * day, without anybody editing a page.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'BHB_VERSION', '1.0.0' );
define( 'BHB_CACHE_KEY', 'bhb_catalogue_v1' );

/* ------------------------------------------------------------------ *
 * Theme setup
 * ------------------------------------------------------------------ */

function bhb_setup() {
	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'custom-logo', array( 'height' => 48, 'width' => 220, 'flex-height' => true, 'flex-width' => true ) );
	add_theme_support( 'html5', array( 'search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script' ) );
	add_theme_support( 'responsive-embeds' );

	register_nav_menus( array(
		'primary' => __( 'Primary menu', 'backhome-buddy' ),
		'footer'  => __( 'Footer menu', 'backhome-buddy' ),
	) );
}
add_action( 'after_setup_theme', 'bhb_setup' );

function bhb_assets() {
	// Sora for display, Inter for body — the same pairing the app uses, so the
	// website and the signed in product do not look like two companies.
	wp_enqueue_style(
		'bhb-fonts',
		'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@600;700;800&display=swap',
		array(),
		null
	);
	wp_enqueue_style( 'bhb-style', get_stylesheet_uri(), array( 'bhb-fonts' ), BHB_VERSION );
}
add_action( 'wp_enqueue_scripts', 'bhb_assets' );

/* ------------------------------------------------------------------ *
 * Settings, in the Customizer where a site owner expects them
 * ------------------------------------------------------------------ */

function bhb_customize( $wp_customize ) {
	$wp_customize->add_section( 'bhb_settings', array(
		'title'       => __( 'Backhome Buddy', 'backhome-buddy' ),
		'priority'    => 30,
		'description' => __( 'The app address is what makes the service list and prices on this site stay correct.', 'backhome-buddy' ),
	) );

	$fields = array(
		'bhb_app_url'   => array( 'label' => 'App address (no trailing slash)', 'default' => 'https://app.backhomebuddy.ng', 'type' => 'url' ),
		'bhb_email'     => array( 'label' => 'Contact email', 'default' => 'hello@backhomebuddy.ng', 'type' => 'text' ),
		'bhb_phone'     => array( 'label' => 'Contact phone (optional)', 'default' => '', 'type' => 'text' ),
		'bhb_privacy'   => array( 'label' => 'Privacy policy URL', 'default' => '/privacy-policy/', 'type' => 'text' ),
		'bhb_terms'     => array( 'label' => 'Terms of service URL', 'default' => '/terms-of-service/', 'type' => 'text' ),
	);

	foreach ( $fields as $id => $f ) {
		$wp_customize->add_setting( $id, array(
			'default'           => $f['default'],
			'sanitize_callback' => 'url' === $f['type'] ? 'esc_url_raw' : 'sanitize_text_field',
			'transport'         => 'refresh',
		) );
		$wp_customize->add_control( $id, array(
			'label'   => $f['label'],
			'section' => 'bhb_settings',
			'type'    => 'url' === $f['type'] ? 'url' : 'text',
		) );
	}
}
add_action( 'customize_register', 'bhb_customize' );

function bhb_app_url() {
	return untrailingslashit( trim( (string) get_theme_mod( 'bhb_app_url', 'https://app.backhomebuddy.ng' ) ) );
}

/** A link into the app: sign up, sign in, apply. */
function bhb_app_link( $path = '/' ) {
	$base = bhb_app_url();
	return $base ? esc_url( $base . $path ) : '#';
}

/* ------------------------------------------------------------------ *
 * The catalogue
 * ------------------------------------------------------------------ */

function bhb_cache_seconds() {
	return (int) apply_filters( 'bhb_cache_seconds', 6 * HOUR_IN_SECONDS );
}

/**
 * Read the catalogue, and fail soft.
 *
 * If the app cannot be reached the last good copy is shown rather than an
 * empty section: a marketing page that breaks when an API is slow is worse
 * than one that is a few hours out of date.
 */
function bhb_fetch_catalogue( $force = false ) {
	$cached = get_transient( BHB_CACHE_KEY );
	if ( ! $force && is_array( $cached ) ) {
		return $cached;
	}

	$base = bhb_app_url();
	if ( '' === $base ) {
		return is_array( $cached ) ? $cached : null;
	}

	$res = wp_remote_get( $base . '/api/public/services', array(
		'timeout' => 8,
		'headers' => array( 'accept' => 'application/json' ),
	) );

	if ( is_wp_error( $res ) || 200 !== (int) wp_remote_retrieve_response_code( $res ) ) {
		return is_array( $cached ) ? $cached : null;
	}

	$data = json_decode( wp_remote_retrieve_body( $res ), true );
	if ( ! is_array( $data ) || empty( $data['services'] ) ) {
		return is_array( $cached ) ? $cached : null;
	}

	set_transient( BHB_CACHE_KEY, $data, bhb_cache_seconds() );
	update_option( 'bhb_last_good', $data, false );
	return $data;
}

function bhb_catalogue() {
	$data = bhb_fetch_catalogue();
	if ( is_array( $data ) && ! empty( $data['services'] ) ) {
		return $data;
	}
	$last = get_option( 'bhb_last_good', null );
	return is_array( $last ) ? $last : null;
}

function bhb_services( $mode = 'all' ) {
	$data = bhb_catalogue();
	if ( ! $data ) {
		return array();
	}
	$services = $data['services'];
	if ( 'pay_now' === $mode ) {
		return array_values( array_filter( $services, function ( $s ) { return ! empty( $s['pay_now'] ); } ) );
	}
	if ( 'quoted' === $mode ) {
		return array_values( array_filter( $services, function ( $s ) { return empty( $s['pay_now'] ); } ) );
	}
	return $services;
}

function bhb_vetting_steps() {
	$data = bhb_catalogue();
	return ( $data && ! empty( $data['vetting'] ) ) ? $data['vetting'] : array();
}

function bhb_states() {
	$data = bhb_catalogue();
	return ( $data && ! empty( $data['states'] ) ) ? $data['states'] : array();
}

/* ------------------------------------------------------------------ *
 * Reusable blocks
 * ------------------------------------------------------------------ */

/** One service, as a row. A list, not a card: somebody here is comparing what
 *  is on offer and what it costs, and a list answers that down one column. */
function bhb_service_row( $s ) {
	?>
	<li class="bhb-row">
		<div>
			<h3 class="bhb-row__name">
				<?php echo esc_html( $s['name'] ); ?>
				<?php if ( ! empty( $s['pay_now'] ) ) : ?>
					<span class="bhb-tag">pay and start</span>
				<?php endif; ?>
			</h3>
			<?php if ( ! empty( $s['description'] ) ) : ?>
				<p class="bhb-row__desc"><?php echo esc_html( $s['description'] ); ?></p>
			<?php endif; ?>
			<?php if ( ! empty( $s['handles_cash'] ) ) : ?>
				<p class="bhb-row__note">We pay the institution directly and photograph the receipt. Your buddy never holds the cash.</p>
			<?php endif; ?>
		</div>
		<p class="bhb-row__price"><?php echo esc_html( $s['price_label'] ); ?></p>
	</li>
	<?php
}

/**
 * The proof stamp.
 *
 * Both variants exist on purpose, and the weaker one is shown beside the
 * stronger. A site that only ever shows its best outcome is making a claim;
 * one that labels its worst is making a promise.
 */
function bhb_proof_strip( $variant = 'ok', $caption = '' ) {
	$ok = ( 'ok' === $variant );
	?>
	<figure class="bhb-proof__item">
		<div class="bhb-strip bhb-strip--<?php echo $ok ? 'ok' : 'warn'; ?>">
			<span class="bhb-strip__dot" aria-hidden="true"><?php echo $ok ? '&#10003;' : '!'; ?></span>
			<div>
				<p class="bhb-strip__title"><?php echo $ok ? 'Verified capture' : 'Uploaded from gallery'; ?></p>
				<p class="bhb-strip__meta">
					<?php
					echo $ok
						? '14 Oct 2026, 11:42 WAT &middot; 7.3775, 3.9470 &middot; accurate to 8&nbsp;m'
						: 'No location captured &middot; received by us 14 Oct 2026, 19:05 WAT';
					?>
				</p>
			</div>
		</div>
		<?php if ( $caption ) : ?>
			<figcaption class="bhb-proof__cap"><?php echo esc_html( $caption ); ?></figcaption>
		<?php endif; ?>
	</figure>
	<?php
}

/** The artefact itself, drawn rather than photographed: a client's family home
 *  is theirs and not ours to publish. */
function bhb_proof_frame() {
	?>
	<figure class="bhb-frame">
		<svg viewBox="0 0 440 340" role="img" aria-label="A proof photograph stamped with the time and the coordinates it was taken at">
			<defs><clipPath id="bhbFrameClip"><rect x="0" y="0" width="440" height="340" rx="16" /></clipPath></defs>
			<g clip-path="url(#bhbFrameClip)">
				<rect x="0" y="0" width="440" height="340" fill="#2B2B2E" />
				<rect x="0" y="0" width="440" height="150" fill="#3A3A3F" />
				<rect x="0" y="212" width="440" height="128" fill="#232326" />
				<rect x="24" y="118" width="392" height="96" fill="#44444A" />
				<rect x="150" y="128" width="140" height="86" fill="#2E2E33" />
				<rect x="160" y="136" width="6" height="70" fill="#52525A" />
				<rect x="186" y="136" width="6" height="70" fill="#52525A" />
				<rect x="212" y="136" width="6" height="70" fill="#52525A" />
				<rect x="238" y="136" width="6" height="70" fill="#52525A" />
				<rect x="264" y="136" width="6" height="70" fill="#52525A" />
				<rect x="128" y="110" width="18" height="104" fill="#55555C" />
				<rect x="294" y="110" width="18" height="104" fill="#55555C" />
				<rect x="372" y="150" width="7" height="64" fill="#3F3F45" />
				<circle cx="375" cy="140" r="26" fill="#35353A" />
				<rect x="0" y="262" width="440" height="78" fill="rgba(17,17,19,0.86)" />
				<rect x="0" y="262" width="5" height="78" fill="#079516" />
				<circle cx="32" cy="288" r="9" fill="#079516" />
				<path d="M27.5 288.5l3.2 3.2 6-6.4" stroke="#fff" stroke-width="2.1" fill="none" stroke-linecap="round" stroke-linejoin="round" />
				<text x="50" y="292" fill="#ffffff" font-size="14" font-weight="700" font-family="Sora, sans-serif">Verified capture</text>
				<text x="50" y="313" fill="#B9B9BE" font-size="11.5" font-family="Inter, sans-serif">14 Oct 2026, 11:42 WAT &#183; 7.3775, 3.9470 &#183; accurate to 8 m</text>
			</g>
		</svg>
	</figure>
	<?php
}

/* ------------------------------------------------------------------ *
 * Shortcodes, so these blocks can also be dropped into any page
 * ------------------------------------------------------------------ */

function bhb_sc_services( $atts ) {
	$atts = shortcode_atts( array( 'mode' => 'all', 'heading' => '' ), $atts, 'bhb_services' );
	$services = bhb_services( $atts['mode'] );
	if ( empty( $services ) ) {
		return '';
	}
	ob_start();
	echo '<section class="bhb-block">';
	if ( '' !== $atts['heading'] ) {
		echo '<h2 class="bhb-h2">' . esc_html( $atts['heading'] ) . '</h2>';
	}
	echo '<ul class="bhb-list">';
	foreach ( $services as $s ) {
		bhb_service_row( $s );
	}
	echo '</ul>';
	echo '<p class="bhb-foot">Prices shown are for Lagos and Abuja. Other states carry a small uplift, shown to you when you pick your state, before you pay anything.</p>';
	echo '</section>';
	return ob_get_clean();
}

function bhb_sc_vetting( $atts ) {
	$atts  = shortcode_atts( array( 'heading' => '', 'limit' => 0 ), $atts, 'bhb_vetting' );
	$steps = bhb_vetting_steps();
	if ( empty( $steps ) ) {
		return '';
	}
	if ( (int) $atts['limit'] > 0 ) {
		$steps = array_slice( $steps, 0, (int) $atts['limit'] );
	}
	ob_start();
	echo '<section class="bhb-block">';
	if ( '' !== $atts['heading'] ) {
		echo '<h2 class="bhb-h2">' . esc_html( $atts['heading'] ) . '</h2>';
	}
	echo '<ol class="bhb-steps">';
	foreach ( $steps as $i => $step ) {
		echo '<li class="bhb-step"><span class="bhb-step__n">' . esc_html( $i + 1 ) . '</span><div>'
			. '<h3 class="bhb-step__title">' . esc_html( $step['title'] ) . '</h3>'
			. '<p class="bhb-step__body">' . esc_html( $step['body'] ) . '</p></div></li>';
	}
	echo '</ol></section>';
	return ob_get_clean();
}

function bhb_sc_proof() {
	ob_start();
	echo '<section class="bhb-block"><div class="bhb-proof">';
	bhb_proof_strip( 'ok', 'Taken in the app. The time and the coordinates are part of the picture, and we record separately when it reached us.' );
	bhb_proof_strip( 'warn', 'Sent from a gallery instead. It still counts as proof, and it still says plainly that it carries no location. You are always told which kind you got.' );
	echo '</div></section>';
	return ob_get_clean();
}

function bhb_sc_states() {
	$states = bhb_states();
	if ( empty( $states ) ) {
		return '';
	}
	return '<p class="bhb-states">Working in ' . esc_html( (string) count( $states ) ) . ' states: '
		. esc_html( implode( ', ', $states ) ) . '.</p>';
}

/**
 * What we do NOT claim.
 *
 * Deliberately written into the theme rather than fetched. It is a statement
 * about what the business does not do, and it should change only when somebody
 * decides to change it, never because an endpoint changed shape. Claiming
 * background checks we do not perform was the second worst thing on the old
 * site; this is the correction.
 */
function bhb_sc_caveat() {
	ob_start();
	?>
	<section class="bhb-block bhb-caveat">
		<h2 class="bhb-h2">What we do not claim</h2>
		<p class="bhb-p"><strong>We do not run a criminal record check on every buddy.</strong> We collect a Police Character Certificate where somebody already has one, and it is not required. In Nigeria that document is slow, inconsistently issued and easy to buy, so requiring it would have filtered for patience and money rather than for character, while letting us say a word we had not earned.</p>
		<p class="bhb-p">What we rely on instead is harder to fake than a certificate: an identity a bank has already verified with fingerprints, two guarantors we can telephone, a signed agreement, a scored interview and a trial task done under observation. For work involving a vulnerable person we also meet the buddy in person, and for high value work we verify their identity against a government record.</p>
		<p class="bhb-p">If a criminal record check matters to you for a particular task, say so when you describe it. We will arrange it, tell you what it costs and how long it will take, and we will not pretend it was already done.</p>
	</section>
	<?php
	return ob_get_clean();
}

// Guarded: if the companion plugin is also installed, let it own the
// shortcodes rather than registering them twice.
add_action( 'init', function () {
	$map = array(
		'bhb_services'       => 'bhb_sc_services',
		'bhb_vetting'        => 'bhb_sc_vetting',
		'bhb_vetting_caveat' => 'bhb_sc_caveat',
		'bhb_proof'          => 'bhb_sc_proof',
		'bhb_states'         => 'bhb_sc_states',
	);
	foreach ( $map as $tag => $cb ) {
		if ( ! shortcode_exists( $tag ) ) {
			add_shortcode( $tag, $cb );
		}
	}
} );

/* ------------------------------------------------------------------ *
 * A refresh button, so a price change does not wait six hours
 * ------------------------------------------------------------------ */

function bhb_admin_menu() {
	add_theme_page( 'Backhome Buddy catalogue', 'BHB catalogue', 'manage_options', 'bhb-catalogue', 'bhb_admin_page' );
}
add_action( 'admin_menu', 'bhb_admin_menu' );

function bhb_admin_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	if ( isset( $_POST['bhb_refresh'] ) && check_admin_referer( 'bhb_refresh_action' ) ) {
		delete_transient( BHB_CACHE_KEY );
		$fresh = bhb_fetch_catalogue( true );
		echo '<div class="notice notice-' . ( $fresh ? 'success' : 'error' ) . '"><p>'
			. ( $fresh ? esc_html( sprintf( 'Refreshed: %d services.', count( $fresh['services'] ) ) )
				: 'Could not reach the app. Check the address in Appearance, Customize, Backhome Buddy.' )
			. '</p></div>';
	}
	$data = bhb_catalogue();
	?>
	<div class="wrap">
		<h1>Catalogue</h1>
		<p>Read from <code><?php echo esc_html( bhb_app_url() ); ?></code> and cached for six hours. Change a service or a price in the app and it appears here.</p>
		<?php if ( $data && ! empty( $data['services'] ) ) : ?>
			<table class="widefat striped" style="max-width:820px">
				<thead><tr><th>Service</th><th>Price shown</th><th>Pay without a quote</th></tr></thead>
				<tbody>
				<?php foreach ( $data['services'] as $s ) : ?>
					<tr>
						<td><?php echo esc_html( $s['name'] ); ?></td>
						<td><?php echo esc_html( $s['price_label'] ); ?></td>
						<td><?php echo ! empty( $s['pay_now'] ) ? 'Yes' : 'No'; ?></td>
					</tr>
				<?php endforeach; ?>
				</tbody>
			</table>
		<?php else : ?>
			<p><strong>Nothing loaded.</strong> Set the app address in Appearance, Customize, Backhome Buddy, then refresh.</p>
		<?php endif; ?>
		<form method="post"><?php wp_nonce_field( 'bhb_refresh_action' ); ?><?php submit_button( 'Refresh now', 'secondary', 'bhb_refresh', false ); ?></form>
	</div>
	<?php
}
