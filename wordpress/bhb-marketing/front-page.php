<?php
/**
 * The front page.
 *
 * The hero is the artefact the business produces, not a slogan over a
 * gradient. A diaspora client is not buying an errand, which a relative would
 * run for nothing. They are buying evidence and recourse, so the evidence is
 * the first thing on the page and at a size where its stamp can be read.
 *
 * There are no statistics anywhere on this page. Not because none would be
 * impressive, but because none can be evidenced, and the ones that used to be
 * here were invented.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
$GLOBALS['bhb_dark_header'] = true;
get_header();

$bhb_all      = bhb_services( 'all' );
$bhb_pay_now  = bhb_services( 'pay_now' );
$bhb_states   = bhb_states();
$bhb_steps    = bhb_vetting_steps();
$bhb_monthly  = array_values( array_filter( $bhb_all, function ( $s ) {
	return (bool) preg_match( '/family|property/i', $s['name'] );
} ) );
?>

<section class="bhb-hero">
	<div class="bhb-wrap bhb-hero__grid">
		<div class="bhb-hero__copy">
			<h1 class="bhb-hero__title">Your cousin will do it for free. We will do it with receipts.</h1>
			<p class="bhb-hero__sub">
				Documents, property checks, bills paid and visits to your parents, done in Nigeria by someone we have
				vetted and photographed where and when it happened.
			</p>
			<div class="bhb-hero__actions">
				<a class="bhb-btn bhb-btn--primary bhb-btn--lg" href="<?php echo bhb_app_link( '/signup' ); ?>">Start a task</a>
				<a class="bhb-btn bhb-btn--ghost bhb-btn--lg" href="<?php echo esc_url( home_url( '/services/' ) ); ?>">See what it costs</a>
			</div>
			<?php if ( ! empty( $bhb_states ) ) : ?>
				<p class="bhb-hero__meta">Working in <?php echo esc_html( (string) count( $bhb_states ) ); ?> states across Nigeria.</p>
			<?php endif; ?>
		</div>

		<div class="bhb-hero__art">
			<?php bhb_proof_frame(); ?>
			<p class="bhb-hero__cap">Every photograph arrives stamped like this: when it was taken, where, and how accurate the reading was.</p>
		</div>
	</div>
</section>

<section class="bhb-section">
	<div class="bhb-wrap">
		<h2 class="bhb-h2 bhb-h2--tight">How would you know it was not staged?</h2>
		<p class="bhb-lede">
			This is the question everybody asks after they have been let down once, and it is the only one worth
			answering properly. Four things are true of every photograph you receive.
		</p>

		<dl class="bhb-anatomy">
			<div><dt>Taken in the app, not uploaded to it</dt><dd>The camera opens inside Backhome Buddy. A picture taken that way carries the moment and the place it was taken, and is labelled as live capture.</dd></div>
			<div><dt>Coordinates, not a place name</dt><dd>Latitude and longitude with an accuracy reading, so you can put it on a map yourself rather than take our word for where it was.</dd></div>
			<div><dt>Two clocks, one of them ours</dt><dd>The phone's time and, separately, the time our server received the file. A phone clock can be changed. Ours cannot be changed by whoever took the photograph.</dd></div>
			<div><dt>A visible label when there is no location</dt><dd>If the picture came from a gallery instead, it says so, in those words, on your screen. You are never shown an unverified photograph dressed as a verified one.</dd></div>
		</dl>

		<div class="bhb-proof">
			<?php
			bhb_proof_strip( 'ok', 'Taken in the app. The time and the coordinates are part of the picture, and we record separately when it reached us.' );
			bhb_proof_strip( 'warn', 'Sent from a gallery instead. It still counts as proof, and it still says plainly that it carries no location. You are always told which kind you got.' );
			?>
		</div>
	</div>
</section>

<?php if ( ! empty( $bhb_all ) ) : ?>
<section class="bhb-section bhb-section--tint">
	<div class="bhb-wrap">
		<h2 class="bhb-h2">What we do</h2>
		<?php if ( ! empty( $bhb_pay_now ) ) : ?>
			<p class="bhb-lede">
				Where there is a price below, that is the price. Choose it, pay, and we start. No quote to wait for
				and nobody to chase.
			</p>
		<?php endif; ?>
		<ul class="bhb-list">
			<?php foreach ( $bhb_all as $bhb_s ) { bhb_service_row( $bhb_s ); } ?>
		</ul>
		<p class="bhb-foot">Prices shown are for Lagos and Abuja. Other states carry a small uplift, shown to you the moment you pick your state, before you pay anything.</p>
	</div>
</section>
<?php endif; ?>

<?php if ( ! empty( $bhb_monthly ) ) : ?>
<section class="bhb-section">
	<div class="bhb-wrap bhb-split">
		<div>
			<h2 class="bhb-h2 bhb-h2--tight">If it is every month, stop asking every month</h2>
			<p class="bhb-lede">
				Somebody looks in on your mother on the same day each month. The bills get paid. Someone walks the land
				and sends you pictures. One price agreed once, a visit that arranges itself, and nothing to request or
				approve in between.
			</p>
			<p class="bhb-note">
				You can pause it or stop it yourself, from your own account, without emailing anybody. A month you
				paused is not charged.
			</p>
			<a class="bhb-btn bhb-btn--primary bhb-btn--lg" href="<?php echo bhb_app_link( '/signup' ); ?>">Set up something monthly</a>
		</div>
		<ul class="bhb-cards">
			<?php foreach ( $bhb_monthly as $bhb_m ) : ?>
				<li class="bhb-card">
					<h3 class="bhb-card__title"><?php echo esc_html( $bhb_m['name'] ); ?></h3>
					<p class="bhb-card__body">
						<?php
						echo false !== stripos( $bhb_m['name'], 'property' )
							? 'Tenant and caretaker checks, rent followed up, the place walked and photographed.'
							: 'A visit, photographs, a written report, and a call with you afterwards. Hospital appointments included.';
						?>
					</p>
				</li>
			<?php endforeach; ?>
		</ul>
	</div>
</section>
<?php endif; ?>

<?php if ( ! empty( $bhb_steps ) ) : ?>
<section class="bhb-section bhb-section--dark">
	<div class="bhb-wrap">
		<h2 class="bhb-h2 bhb-h2--invert">Before anyone is sent to your family, this happens</h2>
		<p class="bhb-lede bhb-lede--invert">In this order, and the approval does not unlock until every step is done.</p>
		<ol class="bhb-steps bhb-steps--invert">
			<?php foreach ( array_slice( $bhb_steps, 0, 6 ) as $bhb_i => $bhb_step ) : ?>
				<li class="bhb-step">
					<span class="bhb-step__n"><?php echo esc_html( $bhb_i + 1 ); ?></span>
					<div>
						<h3 class="bhb-step__title"><?php echo esc_html( $bhb_step['title'] ); ?></h3>
						<p class="bhb-step__body"><?php echo esc_html( $bhb_step['body'] ); ?></p>
					</div>
				</li>
			<?php endforeach; ?>
		</ol>
		<a class="bhb-link-green" href="<?php echo esc_url( home_url( '/how-we-vet/' ) ); ?>">The whole thing, in detail</a>
	</div>
</section>
<?php endif; ?>

<section class="bhb-section">
	<div class="bhb-wrap">
		<h2 class="bhb-h2 bhb-h2--tight">And if it goes wrong</h2>
		<div class="bhb-prose">
			<p>Your payment sits against your task. It is released to your buddy after the work is done and you have accepted what came back, not before.</p>
			<p><strong>If the task failed because of us or because of the buddy, you get everything back.</strong> That is not a goodwill gesture decided case by case. It is a rule, it is written into the system, and the amount is worked out the same way every time.</p>
			<p>Before a buddy has been assigned, a cancellation is refunded in full. After that a stated portion covers the cost of somebody who has already turned down other work, and you are shown that figure before you confirm anything, never afterwards.</p>
		</div>
		<div class="bhb-hero__actions">
			<a class="bhb-btn bhb-btn--primary bhb-btn--lg" href="<?php echo bhb_app_link( '/signup' ); ?>">Start a task</a>
			<a class="bhb-btn bhb-btn--outline bhb-btn--lg" href="<?php echo bhb_app_link( '/apply' ); ?>">Work with us as a buddy</a>
		</div>
	</div>
</section>

<?php get_footer(); ?>
