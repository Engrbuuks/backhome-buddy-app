<?php
/**
 * Plugin Name:       Backhome Buddy Content
 * Description:       Renders the service catalogue, prices, vetting steps and proof blocks on backhomebuddy.ng, read live from the app so the website can never advertise something the app no longer sells.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Backhome Buddy
 * License:           GPLv2 or later
 * Text Domain:       bhb-content
 *
 * WHY THIS PLUGIN EXISTS
 *
 * The website and the app drifted apart. The homepage went on advertising
 * eight services after two had been retired, and carried figures for tasks
 * completed and client satisfaction that nothing in the system had ever
 * produced. Hand maintained copy of a catalogue always ends that way.
 *
 * So nothing here is typed in. The shortcodes fetch the live catalogue from
 * the app and cache it. Deactivate a service in the admin and it leaves this
 * website within hours, without anybody editing a page.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'BHB_CONTENT_VERSION', '1.0.0' );
define( 'BHB_CONTENT_CACHE_KEY', 'bhb_catalogue_v1' );

/** How long the catalogue is cached. Long enough to cost nothing, short
 *  enough that a price change reaches the website the same day. */
function bhb_content_cache_seconds() {
	return (int) apply_filters( 'bhb_content_cache_seconds', 6 * HOUR_IN_SECONDS );
}

/** Where the app lives. Set in Settings → Backhome Buddy. */
function bhb_content_app_url() {
	$url = get_option( 'bhb_content_app_url', '' );
	return untrailingslashit( trim( (string) $url ) );
}

/**
 * The catalogue, cached.
 *
 * Fails soft on purpose. If the app is unreachable the website keeps showing
 * the last good copy rather than an empty section or an error, because a
 * marketing page that breaks when an API is slow is worse than one that is a
 * few hours stale.
 */
function bhb_content_get_catalogue( $force = false ) {
	$cached = get_transient( BHB_CONTENT_CACHE_KEY );
	if ( ! $force && is_array( $cached ) ) {
		return $cached;
	}

	$base = bhb_content_app_url();
	if ( '' === $base ) {
		return is_array( $cached ) ? $cached : null;
	}

	$response = wp_remote_get(
		$base . '/api/public/services',
		array(
			'timeout' => 8,
			'headers' => array( 'accept' => 'application/json' ),
		)
	);

	if ( is_wp_error( $response ) || 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
		// Keep the stale copy. Never blank the page over a network blip.
		return is_array( $cached ) ? $cached : null;
	}

	$data = json_decode( wp_remote_retrieve_body( $response ), true );
	if ( ! is_array( $data ) || empty( $data['services'] ) ) {
		return is_array( $cached ) ? $cached : null;
	}

	set_transient( BHB_CONTENT_CACHE_KEY, $data, bhb_content_cache_seconds() );
	// A second, far longer copy, so a long outage still has something to show.
	update_option( 'bhb_content_last_good', $data, false );

	return $data;
}

function bhb_content_catalogue_or_last_good() {
	$data = bhb_content_get_catalogue();
	if ( is_array( $data ) && ! empty( $data['services'] ) ) {
		return $data;
	}
	$last = get_option( 'bhb_content_last_good', null );
	return is_array( $last ) ? $last : null;
}

/* ------------------------------------------------------------------ *
 * Shortcodes
 * ------------------------------------------------------------------ */

/**
 * [bhb_services]
 *
 * The catalogue as a list rather than a grid of cards: somebody reading this
 * is comparing what is on offer, what it costs and whether they can pay
 * without a conversation, and a list answers that down one column.
 *
 * Attributes:
 *   mode="all|pay_now|quoted"   which group to show (default all)
 *   heading="..."               optional heading above the list
 */
function bhb_content_services_shortcode( $atts ) {
	$atts = shortcode_atts(
		array(
			'mode'    => 'all',
			'heading' => '',
		),
		$atts,
		'bhb_services'
	);

	$data = bhb_content_catalogue_or_last_good();
	if ( ! $data ) {
		return '';
	}

	$services = $data['services'];
	if ( 'pay_now' === $atts['mode'] ) {
		$services = array_values( array_filter( $services, function ( $s ) { return ! empty( $s['pay_now'] ); } ) );
	} elseif ( 'quoted' === $atts['mode'] ) {
		$services = array_values( array_filter( $services, function ( $s ) { return empty( $s['pay_now'] ); } ) );
	}

	if ( empty( $services ) ) {
		return '';
	}

	ob_start();
	?>
	<section class="bhb-block">
		<?php if ( '' !== $atts['heading'] ) : ?>
			<h2 class="bhb-h2"><?php echo esc_html( $atts['heading'] ); ?></h2>
		<?php endif; ?>
		<ul class="bhb-list">
			<?php foreach ( $services as $s ) : ?>
				<li class="bhb-row">
					<div class="bhb-row__main">
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
			<?php endforeach; ?>
		</ul>
		<p class="bhb-foot">Prices shown are for Lagos and Abuja. Other states carry a small uplift, shown to you when you pick your state, before you pay anything.</p>
	</section>
	<?php
	return ob_get_clean();
}
add_shortcode( 'bhb_services', 'bhb_content_services_shortcode' );

/**
 * [bhb_vetting]
 *
 * The vetting steps, in the order they happen. Numbered because this genuinely
 * is a sequence. Note what is absent: no claim of a criminal record check,
 * because the Police Character Certificate is collected where somebody has one
 * and does not block approval. Use [bhb_vetting_caveat] beside it.
 */
function bhb_content_vetting_shortcode( $atts ) {
	$atts = shortcode_atts( array( 'heading' => '', 'limit' => 0 ), $atts, 'bhb_vetting' );

	$data = bhb_content_catalogue_or_last_good();
	if ( ! $data || empty( $data['vetting'] ) ) {
		return '';
	}

	$steps = $data['vetting'];
	$limit = (int) $atts['limit'];
	if ( $limit > 0 ) {
		$steps = array_slice( $steps, 0, $limit );
	}

	ob_start();
	?>
	<section class="bhb-block">
		<?php if ( '' !== $atts['heading'] ) : ?>
			<h2 class="bhb-h2"><?php echo esc_html( $atts['heading'] ); ?></h2>
		<?php endif; ?>
		<ol class="bhb-steps">
			<?php foreach ( $steps as $i => $step ) : ?>
				<li class="bhb-step">
					<span class="bhb-step__n"><?php echo esc_html( $i + 1 ); ?></span>
					<div>
						<h3 class="bhb-step__title"><?php echo esc_html( $step['title'] ); ?></h3>
						<p class="bhb-step__body"><?php echo esc_html( $step['body'] ); ?></p>
					</div>
				</li>
			<?php endforeach; ?>
		</ol>
	</section>
	<?php
	return ob_get_clean();
}
add_shortcode( 'bhb_vetting', 'bhb_content_vetting_shortcode' );

/**
 * [bhb_vetting_caveat]
 *
 * The admission, which is the reason to believe the rest. Hard coded rather
 * than fetched: it is a statement about what the business does NOT do, and it
 * should only ever change by somebody deciding to change it.
 */
function bhb_content_caveat_shortcode() {
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
add_shortcode( 'bhb_vetting_caveat', 'bhb_content_caveat_shortcode' );

/**
 * [bhb_proof]
 *
 * The two stamps side by side: what a verified photograph carries, and what an
 * uploaded one says instead. Showing the weaker case is what makes the
 * stronger one believable.
 */
function bhb_content_proof_shortcode() {
	ob_start();
	?>
	<section class="bhb-block">
		<div class="bhb-proof">
			<figure class="bhb-proof__item">
				<div class="bhb-strip bhb-strip--ok">
					<span class="bhb-strip__dot bhb-strip__dot--ok" aria-hidden="true">&#10003;</span>
					<div>
						<p class="bhb-strip__title">Verified capture</p>
						<p class="bhb-strip__meta">14 Oct 2026, 11:42 WAT &middot; 7.3775, 3.9470 &middot; accurate to 8&nbsp;m</p>
					</div>
				</div>
				<figcaption class="bhb-proof__cap">Taken in the app. The time and the coordinates are part of the picture, and we record separately when it reached us.</figcaption>
			</figure>
			<figure class="bhb-proof__item">
				<div class="bhb-strip bhb-strip--warn">
					<span class="bhb-strip__dot bhb-strip__dot--warn" aria-hidden="true">!</span>
					<div>
						<p class="bhb-strip__title">Uploaded from gallery</p>
						<p class="bhb-strip__meta">No location captured &middot; received by us 14 Oct 2026, 19:05 WAT</p>
					</div>
				</div>
				<figcaption class="bhb-proof__cap">Sent from a gallery instead. It still counts as proof, and it still says plainly that it carries no location. You are always told which kind you got.</figcaption>
			</figure>
		</div>
	</section>
	<?php
	return ob_get_clean();
}
add_shortcode( 'bhb_proof', 'bhb_content_proof_shortcode' );

/**
 * [bhb_states]
 *
 * The states actually worked in, from the live region list. Replaces any
 * sentence claiming a number of states, which is the kind of claim that goes
 * stale the week after it is written.
 */
function bhb_content_states_shortcode() {
	$data = bhb_content_catalogue_or_last_good();
	if ( ! $data || empty( $data['states'] ) ) {
		return '';
	}
	return '<p class="bhb-states">Working in ' . esc_html( (string) count( $data['states'] ) ) . ' states: '
		. esc_html( implode( ', ', $data['states'] ) ) . '.</p>';
}
add_shortcode( 'bhb_states', 'bhb_content_states_shortcode' );

/* ------------------------------------------------------------------ *
 * Styles
 * ------------------------------------------------------------------ */

function bhb_content_enqueue() {
	wp_register_style( 'bhb-content', plugins_url( 'bhb-content.css', __FILE__ ), array(), BHB_CONTENT_VERSION );
	wp_enqueue_style( 'bhb-content' );
}
add_action( 'wp_enqueue_scripts', 'bhb_content_enqueue' );

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

function bhb_content_settings_menu() {
	add_options_page( 'Backhome Buddy', 'Backhome Buddy', 'manage_options', 'bhb-content', 'bhb_content_settings_page' );
}
add_action( 'admin_menu', 'bhb_content_settings_menu' );

function bhb_content_register_settings() {
	register_setting(
		'bhb_content',
		'bhb_content_app_url',
		array(
			'type'              => 'string',
			'sanitize_callback' => 'esc_url_raw',
			'default'           => '',
		)
	);
}
add_action( 'admin_init', 'bhb_content_register_settings' );

function bhb_content_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	if ( isset( $_POST['bhb_refresh'] ) && check_admin_referer( 'bhb_refresh_action' ) ) {
		delete_transient( BHB_CONTENT_CACHE_KEY );
		$fresh = bhb_content_get_catalogue( true );
		echo '<div class="notice notice-' . ( $fresh ? 'success' : 'error' ) . '"><p>'
			. ( $fresh
				? esc_html( sprintf( 'Catalogue refreshed: %d services.', count( $fresh['services'] ) ) )
				: 'Could not reach the app. Check the address below.' )
			. '</p></div>';
	}

	$data = bhb_content_catalogue_or_last_good();
	?>
	<div class="wrap">
		<h1>Backhome Buddy content</h1>
		<p>The service list, prices, states and vetting steps on this website are read from the app, so the website cannot advertise something the app no longer sells.</p>

		<form method="post" action="options.php">
			<?php settings_fields( 'bhb_content' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="bhb_content_app_url">App address</label></th>
					<td>
						<input name="bhb_content_app_url" id="bhb_content_app_url" type="url" class="regular-text"
							value="<?php echo esc_attr( get_option( 'bhb_content_app_url', '' ) ); ?>"
							placeholder="https://app.backhomebuddy.ng" />
						<p class="description">No trailing slash. This is where clients sign in, not this website.</p>
					</td>
				</tr>
			</table>
			<?php submit_button( 'Save' ); ?>
		</form>

		<hr />
		<h2>Current catalogue</h2>
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
			<p><em>Last read <?php echo esc_html( isset( $data['updated_at'] ) ? $data['updated_at'] : 'unknown' ); ?>. Cached for six hours.</em></p>
		<?php else : ?>
			<p><strong>Nothing loaded yet.</strong> Save the app address above, then press Refresh.</p>
		<?php endif; ?>

		<form method="post">
			<?php wp_nonce_field( 'bhb_refresh_action' ); ?>
			<?php submit_button( 'Refresh now', 'secondary', 'bhb_refresh', false ); ?>
		</form>

		<hr />
		<h2>Shortcodes</h2>
		<table class="widefat striped" style="max-width:820px">
			<tbody>
				<tr><td><code>[bhb_services]</code></td><td>The whole catalogue with prices</td></tr>
				<tr><td><code>[bhb_services mode="pay_now" heading="Pay and we start"]</code></td><td>Only the fixed price services</td></tr>
				<tr><td><code>[bhb_services mode="quoted" heading="Priced for the job"]</code></td><td>Only the quoted services</td></tr>
				<tr><td><code>[bhb_vetting heading="Before anyone is sent to your family"]</code></td><td>The vetting steps, in order</td></tr>
				<tr><td><code>[bhb_vetting limit="6"]</code></td><td>The first six steps, for a homepage</td></tr>
				<tr><td><code>[bhb_vetting_caveat]</code></td><td>What we do not claim. Put this with the steps</td></tr>
				<tr><td><code>[bhb_proof]</code></td><td>The two proof stamps, verified and uploaded</td></tr>
				<tr><td><code>[bhb_states]</code></td><td>The states actually worked in</td></tr>
			</tbody>
		</table>
	</div>
	<?php
}

/** Clear the cache on deactivation so a reinstall starts clean. */
register_deactivation_hook( __FILE__, function () {
	delete_transient( BHB_CONTENT_CACHE_KEY );
} );
