<?php
/**
 * Template Name: Services and prices
 *
 * A list rather than a grid of cards. Somebody arriving here is comparing:
 * what is on offer, what it costs, and whether they can pay without a
 * conversation. A list answers that down one column; six identical boxes make
 * them scan in two directions to answer one question.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
get_header();
$bhb_pay_now = bhb_services( 'pay_now' );
$bhb_quoted  = bhb_services( 'quoted' );
?>
<section class="bhb-section bhb-section--head">
	<div class="bhb-wrap">
		<h1 class="bhb-h1"><?php echo esc_html( get_the_title() ?: 'What we do, and what it costs' ); ?></h1>
		<p class="bhb-lede">
			Five things, done properly, rather than everything done approximately. Every price here is for Lagos and
			Abuja; other states carry a small uplift that is shown to you when you pick your state.
		</p>
	</div>
</section>

<?php if ( ! empty( $bhb_pay_now ) ) : ?>
<section class="bhb-section bhb-section--rule">
	<div class="bhb-wrap">
		<h2 class="bhb-h3">Pay and we start</h2>
		<p class="bhb-note">These have a set price. There is nothing to quote, so there is nothing to wait for.</p>
		<ul class="bhb-list">
			<?php foreach ( $bhb_pay_now as $bhb_s ) { bhb_service_row( $bhb_s ); } ?>
		</ul>
	</div>
</section>
<?php endif; ?>

<?php if ( ! empty( $bhb_quoted ) ) : ?>
<section class="bhb-section bhb-section--rule">
	<div class="bhb-wrap">
		<h2 class="bhb-h3">Priced for the job</h2>
		<p class="bhb-note">These vary too much to publish one figure honestly. Tell us what you need and you get a written price with the costs itemised, free, before anything is agreed.</p>
		<ul class="bhb-list">
			<?php foreach ( $bhb_quoted as $bhb_s ) { bhb_service_row( $bhb_s ); } ?>
		</ul>
	</div>
</section>
<?php endif; ?>

<?php if ( empty( $bhb_pay_now ) && empty( $bhb_quoted ) ) : ?>
<section class="bhb-section"><div class="bhb-wrap">
	<p class="bhb-empty">Our service list is being updated. Send us a message and we will tell you whether we can help.</p>
</div></section>
<?php endif; ?>

<?php if ( trim( get_the_content() ) ) : ?>
<section class="bhb-section"><div class="bhb-wrap"><div class="bhb-prose">
	<?php while ( have_posts() ) { the_post(); the_content(); } ?>
</div></div></section>
<?php endif; ?>

<section class="bhb-section bhb-section--tint">
	<div class="bhb-wrap">
		<h2 class="bhb-h3">Something not on the list</h2>
		<p class="bhb-lede">
			Most of what people ask for is something we have not thought to name. If it can be done lawfully and
			safely, describe it and we will tell you honestly whether we can do it, what it would cost, and what
			evidence you would get back. If we cannot do it, we will say so rather than try.
		</p>
		<div class="bhb-hero__actions">
			<a class="bhb-btn bhb-btn--primary bhb-btn--lg" href="<?php echo bhb_app_link( '/signup' ); ?>">Describe your task</a>
			<a class="bhb-btn bhb-btn--outline bhb-btn--lg" href="<?php echo esc_url( home_url( '/how-we-vet/' ) ); ?>">See how we vet buddies</a>
		</div>
	</div>
</section>
<?php get_footer(); ?>
