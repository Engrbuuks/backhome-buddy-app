<?php
/**
 * Template Name: How we vet
 *
 * The page the business most needed and did not have. The vetting here is
 * better than most of this industry and was completely invisible, while the
 * site claimed "background checks", which is the one thing on the list that is
 * not done. So this says exactly what happens, then says plainly what it does
 * not cover. The admission is the reason to believe the rest.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
get_header();
$bhb_steps = bhb_vetting_steps();
?>
<section class="bhb-section bhb-section--head">
	<div class="bhb-wrap">
		<h1 class="bhb-h1">You are sending a stranger to your mother&rsquo;s house</h1>
		<p class="bhb-lede">
			That is the actual decision, and no amount of friendly copy should make it feel smaller than it is. Here is
			every step somebody passes before we will send them, written out so you can judge it rather than trust it.
		</p>
	</div>
</section>

<?php if ( ! empty( $bhb_steps ) ) : ?>
<section class="bhb-section">
	<div class="bhb-wrap">
		<ol class="bhb-steps-long">
			<?php foreach ( $bhb_steps as $bhb_i => $bhb_step ) : ?>
				<li class="bhb-step">
					<span class="bhb-step__n bhb-step__n--dark"><?php echo esc_html( $bhb_i + 1 ); ?></span>
					<div>
						<h2 class="bhb-step__title bhb-step__title--lg"><?php echo esc_html( $bhb_step['title'] ); ?></h2>
						<p class="bhb-step__body"><?php echo esc_html( $bhb_step['body'] ); ?></p>
					</div>
				</li>
			<?php endforeach; ?>
		</ol>
	</div>
</section>
<?php endif; ?>

<section class="bhb-section bhb-section--tint">
	<div class="bhb-wrap"><?php echo do_shortcode( '[bhb_vetting_caveat]' ); ?></div>
</section>

<section class="bhb-section">
	<div class="bhb-wrap bhb-split">
		<div>
			<h2 class="bhb-h3">Vetting is the start. Evidence is the rest</h2>
			<div class="bhb-prose">
				<p>Checks tell you who somebody is. They cannot tell you what happened on the day. That is what the photographs are for, and why each one carries the time it was taken, the coordinates it was taken at, and a separate record of when it reached us that the person holding the phone cannot alter.</p>
				<p>When a picture comes from a gallery instead of the camera, it says so on your screen, in those words. We would rather show you a weaker piece of evidence honestly labelled than a strong looking one you cannot check.</p>
			</div>
			<a class="bhb-btn bhb-btn--primary bhb-btn--lg" href="<?php echo bhb_app_link( '/signup' ); ?>">Start a task</a>
		</div>
		<div class="bhb-frame-wrap"><?php bhb_proof_frame(); ?></div>
	</div>
</section>

<?php if ( trim( get_the_content() ) ) : ?>
<section class="bhb-section"><div class="bhb-wrap"><div class="bhb-prose">
	<?php while ( have_posts() ) { the_post(); the_content(); } ?>
</div></div></section>
<?php endif; ?>

<section class="bhb-section bhb-section--dark">
	<div class="bhb-wrap">
		<h2 class="bhb-h3 bhb-h2--invert">If you are the person we would be sending, the same standard applies to you</h2>
		<p class="bhb-lede bhb-lede--invert">Buddies are paid per task, and more as they earn trust. The vetting above is what you would go through. It takes a little while and it is the reason clients let us into their families&rsquo; homes.</p>
		<a class="bhb-btn bhb-btn--ghost bhb-btn--lg" href="<?php echo bhb_app_link( '/apply' ); ?>">Apply to be a buddy</a>
	</div>
</section>
<?php get_footer(); ?>
