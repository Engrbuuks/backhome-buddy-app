<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
get_header(); ?>
<section class="bhb-section bhb-section--head">
	<div class="bhb-wrap"><h1 class="bhb-h1"><?php the_title(); ?></h1></div>
</section>
<section class="bhb-section">
	<div class="bhb-wrap"><div class="bhb-prose">
		<?php while ( have_posts() ) { the_post(); the_content(); } ?>
	</div></div>
</section>
<?php get_footer(); ?>
