<?php
/** Fallback template. Required by WordPress even when every route has a more
 *  specific one; this keeps a stray archive or post readable rather than bare. */
if ( ! defined( 'ABSPATH' ) ) { exit; }
get_header(); ?>
<section class="bhb-section bhb-section--head">
	<div class="bhb-wrap">
		<h1 class="bhb-h1"><?php echo is_home() ? esc_html( get_bloginfo( 'name' ) ) : wp_kses_post( get_the_archive_title() ); ?></h1>
	</div>
</section>
<section class="bhb-section">
	<div class="bhb-wrap">
		<?php if ( have_posts() ) : ?>
			<ul class="bhb-list">
				<?php while ( have_posts() ) : the_post(); ?>
					<li class="bhb-row">
						<div>
							<h2 class="bhb-row__name"><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
							<p class="bhb-row__desc"><?php echo esc_html( wp_trim_words( get_the_excerpt(), 34 ) ); ?></p>
						</div>
					</li>
				<?php endwhile; ?>
			</ul>
			<div class="bhb-pager"><?php the_posts_pagination( array( 'mid_size' => 1 ) ); ?></div>
		<?php else : ?>
			<p class="bhb-empty">Nothing here yet.</p>
		<?php endif; ?>
	</div>
</section>
<?php get_footer(); ?>
