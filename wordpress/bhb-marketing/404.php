<?php
/** An empty screen is an invitation to act, not a mood. */
if ( ! defined( 'ABSPATH' ) ) { exit; }
get_header(); ?>
<section class="bhb-section bhb-section--head">
	<div class="bhb-wrap">
		<h1 class="bhb-h1">That page is not here</h1>
		<p class="bhb-lede">It may have moved, or the address may be slightly wrong. These are the pages people usually want.</p>
		<div class="bhb-hero__actions">
			<a class="bhb-btn bhb-btn--primary bhb-btn--lg" href="<?php echo esc_url( home_url( '/services/' ) ); ?>">What we do</a>
			<a class="bhb-btn bhb-btn--outline bhb-btn--lg" href="<?php echo esc_url( home_url( '/how-we-vet/' ) ); ?>">How we vet buddies</a>
			<a class="bhb-btn bhb-btn--outline bhb-btn--lg" href="<?php echo bhb_app_link( '/signup' ); ?>">Start a task</a>
		</div>
	</div>
</section>
<?php get_footer(); ?>
